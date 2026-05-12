import json
import os
import sqlite3
import time
from pathlib import Path

from flask import Flask, jsonify, render_template, request, session, redirect, url_for
from werkzeug.security import check_password_hash

from .db import get_db, close_db, init_db, DB_PATH
from .auth import require_role, current_user
from .normalize import normalize_name, similarity, jaccard


def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.secret_key = os.environ.get("POSTEMAIL_SECRET", "dev-secret-change-me")
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    if not DB_PATH.exists():
        init_db()
    else:
        # 增量补建新表（schema 全部用 CREATE IF NOT EXISTS，幂等）
        init_db()

    app.teardown_appcontext(close_db)

    # ------- Pages -------
    @app.get("/")
    def page_index():
        return render_template("index.html")

    @app.get("/admin")
    def page_admin():
        if not current_user():
            return redirect(url_for("page_login"))
        return render_template("admin.html")

    @app.get("/admin/industries")
    def page_admin_industries():
        user = current_user()
        if not user:
            return redirect(url_for("page_login"))
        if user.get("role") != "admin":
            return ("需要 admin 角色才能访问行业管理。<a href='/admin'>返回规则后台</a>", 403)
        return render_template("admin_industries.html")

    @app.get("/login")
    def page_login():
        return render_template("login.html")

    @app.get("/api/health")
    def health():
        return jsonify({"code": 0, "msg": "ok"})

    # ------- Auth -------
    @app.post("/api/auth/login")
    def api_login():
        body = request.get_json(silent=True) or {}
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        if not username or not password:
            return jsonify({"code": 400, "msg": "用户名或密码为空"}), 400
        row = get_db().execute(
            "SELECT id, username, password_hash, role FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if not row or not check_password_hash(row["password_hash"], password):
            return jsonify({"code": 401, "msg": "用户名或密码错误"}), 401
        session["user_id"] = row["id"]
        return jsonify({"code": 0, "data": {"username": row["username"], "role": row["role"]}})

    @app.post("/api/auth/logout")
    def api_logout():
        session.clear()
        return jsonify({"code": 0})

    @app.get("/api/auth/me")
    def api_me():
        user = current_user()
        return jsonify({"code": 0, "data": user})

    # ------- Scenarios -------
    @app.get("/api/scenarios")
    def api_scenarios():
        rows = get_db().execute(
            "SELECT id, key, label, sort_order FROM scenarios ORDER BY sort_order, id"
        ).fetchall()
        return jsonify({"code": 0, "data": [dict(row) for row in rows]})

    def _scenario_log(db, type_id, type_key, action, before=None, after=None):
        user = current_user() or {}
        db.execute(
            "INSERT INTO product_type_change_log(type_id, type_key, action, before, after, actor) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                type_id,
                type_key,
                action,
                json.dumps(before or {}, ensure_ascii=False, default=str),
                json.dumps(after or {}, ensure_ascii=False, default=str),
                user.get("username", ""),
            ),
        )

    def _ensure_scenario_key(db):
        return f"type_{int(time.time() * 1000)}"

    def _ensure_fallback_scenario(db, deleting_id):
        row = db.execute(
            "SELECT id, key, label FROM scenarios WHERE id<>? AND (key='other' OR label='其他 / 待归类') "
            "ORDER BY CASE WHEN key='other' THEN 0 ELSE 1 END, id LIMIT 1",
            (deleting_id,),
        ).fetchone()
        if row:
            return row
        order_row = db.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS o FROM scenarios").fetchone()
        key = f"fallback_{int(time.time() * 1000)}"
        cur = db.execute(
            "INSERT INTO scenarios(key, label, sort_order) VALUES (?, ?, ?)",
            (key, "其他 / 待归类", order_row["o"]),
        )
        return db.execute("SELECT id, key, label FROM scenarios WHERE id=?", (cur.lastrowid,)).fetchone()

    @app.post("/api/scenarios")
    @require_role("admin")
    def api_scenarios_create():
        body = request.get_json(silent=True) or {}
        label = (body.get("label") or "").strip()
        if not label:
            return jsonify({"code": 400, "msg": "产品类型名称不能为空"}), 400
        if body.get("confirm") is not True:
            return jsonify({"code": 400, "msg": "请确认后再新增产品类型"}), 400
        db = get_db()
        if db.execute("SELECT id FROM scenarios WHERE label=?", (label,)).fetchone():
            return jsonify({"code": 409, "msg": "该产品类型已存在"}), 409
        order_row = db.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS o FROM scenarios").fetchone()
        key = _ensure_scenario_key(db)
        try:
            cur = db.execute(
                "INSERT INTO scenarios(key, label, sort_order) VALUES (?, ?, ?)",
                (key, label, order_row["o"]),
            )
            _scenario_log(db, cur.lastrowid, key, "create", after={"label": label})
            db.commit()
        except sqlite3.IntegrityError:
            db.rollback()
            return jsonify({"code": 409, "msg": "产品类型创建冲突，请重试"}), 409
        return jsonify({"code": 0, "data": {"id": cur.lastrowid, "key": key, "label": label}})

    @app.put("/api/scenarios/<int:scenario_id>")
    @require_role("admin")
    def api_scenarios_update(scenario_id):
        body = request.get_json(silent=True) or {}
        label = (body.get("label") or "").strip()
        if not label:
            return jsonify({"code": 400, "msg": "产品类型名称不能为空"}), 400
        if body.get("confirm") is not True:
            return jsonify({"code": 400, "msg": "请确认后再修改产品类型"}), 400
        db = get_db()
        old = db.execute("SELECT id, key, label, sort_order FROM scenarios WHERE id=?", (scenario_id,)).fetchone()
        if not old:
            return jsonify({"code": 404, "msg": "产品类型不存在"}), 404
        duplicate = db.execute("SELECT id FROM scenarios WHERE label=? AND id<>?", (label, scenario_id)).fetchone()
        if duplicate:
            return jsonify({"code": 409, "msg": "该产品类型已存在"}), 409
        if old["label"] == label:
            return jsonify({"code": 0, "data": {"changed": False}})
        db.execute("UPDATE scenarios SET label=? WHERE id=?", (label, scenario_id))
        _scenario_log(
            db,
            scenario_id,
            old["key"],
            "update",
            before={"label": old["label"]},
            after={"label": label},
        )
        db.commit()
        return jsonify({"code": 0, "data": {"changed": True}})

    @app.put("/api/scenarios/reorder")
    @require_role("admin")
    def api_scenarios_reorder():
        body = request.get_json(silent=True) or {}
        ids = body.get("ids") or []
        if not isinstance(ids, list) or not ids:
            return jsonify({"code": 400, "msg": "ids 必须是非空数组"}), 400
        try:
            ids = [int(x) for x in ids]
        except (TypeError, ValueError):
            return jsonify({"code": 400, "msg": "ids 只能包含产品类型 ID"}), 400
        if len(ids) != len(set(ids)):
            return jsonify({"code": 400, "msg": "ids 不能重复"}), 400
        db = get_db()
        rows = db.execute("SELECT id, key, label, sort_order FROM scenarios ORDER BY sort_order, id").fetchall()
        existing_ids = [row["id"] for row in rows]
        if set(ids) != set(existing_ids):
            return jsonify({"code": 400, "msg": "排序数据和当前产品类型不一致，请刷新后重试"}), 400
        before = [{"id": row["id"], "label": row["label"]} for row in rows]
        label_map = {row["id"]: row["label"] for row in rows}
        after = [{"id": sid, "label": label_map.get(sid, f"#{sid}")} for sid in ids]
        if existing_ids == ids:
            return jsonify({"code": 0, "data": {"changed": False}})
        try:
            for index, scenario_id in enumerate(ids):
                db.execute("UPDATE scenarios SET sort_order=? WHERE id=?", (index, scenario_id))
            _scenario_log(
                db,
                None,
                "__reorder__",
                "reorder",
                before={"order": before},
                after={"order": after},
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            return jsonify({"code": 500, "msg": f"排序保存失败：{exc}"}), 500
        return jsonify({"code": 0, "data": {"changed": True}})

    @app.delete("/api/scenarios/<int:scenario_id>")
    @require_role("admin")
    def api_scenarios_delete(scenario_id):
        body = request.get_json(silent=True) or {}
        if body.get("confirm") is not True:
            return jsonify({"code": 400, "msg": "请确认后再删除产品类型"}), 400
        db = get_db()
        old = db.execute("SELECT id, key, label, sort_order FROM scenarios WHERE id=?", (scenario_id,)).fetchone()
        if not old:
            return jsonify({"code": 404, "msg": "产品类型不存在"}), 404
        product_count = db.execute("SELECT COUNT(*) AS c FROM products WHERE scenario_id=?", (scenario_id,)).fetchone()["c"]
        fallback = _ensure_fallback_scenario(db, scenario_id)
        try:
            if product_count:
                db.execute("UPDATE products SET scenario_id=?, updated_at=CURRENT_TIMESTAMP WHERE scenario_id=?", (fallback["id"], scenario_id))
            db.execute("DELETE FROM scenarios WHERE id=?", (scenario_id,))
            _scenario_log(
                db,
                scenario_id,
                old["key"],
                "delete",
                before={"label": old["label"], "product_count": product_count},
                after={"moved_to": fallback["label"], "moved_to_id": fallback["id"]},
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            return jsonify({"code": 500, "msg": f"删除失败：{exc}"}), 500
        return jsonify({"code": 0, "data": {"deleted": scenario_id, "moved_products": product_count, "moved_to": fallback["label"]}})

    @app.get("/api/scenarios/change-log")
    @require_role("admin")
    def api_scenarios_change_log():
        limit = min(int(request.args.get("limit", 100) or 100), 500)
        rows = get_db().execute(
            "SELECT id, type_id, type_key, action, before, after, actor, created_at "
            "FROM product_type_change_log ORDER BY created_at DESC, id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        data = []
        for r in rows:
            d = dict(r)
            d["before"] = json.loads(d.get("before") or "{}")
            d["after"] = json.loads(d.get("after") or "{}")
            data.append(d)
        return jsonify({"code": 0, "data": data})

    # ------- Products -------
    @app.get("/api/products")
    def api_products_list():
        scenario = request.args.get("scenario")
        keyword = (request.args.get("q") or "").strip()
        status = request.args.get("status", "active")
        sql = (
            "SELECT p.id, p.scenario_id, s.label AS scenario_label, p.name, p.aliases, "
            "p.status, p.source, p.updated_at, "
            "COALESCE(r.price_type, 'discount') AS price_type, "
            "COALESCE(r.price_unit, '') AS price_unit, "
            "r.normal_discount, r.normal_commission, r.breakthrough_discount, "
            "r.breakthrough_commission, r.billing_modes, r.no_commission, r.remark, "
            "r.updated_by, r.updated_at AS rule_updated_at "
            "FROM products p "
            "LEFT JOIN scenarios s ON s.id = p.scenario_id "
            "LEFT JOIN pricing_rules r ON r.product_id = p.id "
            "WHERE 1=1 "
        )
        params = []
        if status and status != "all":
            sql += "AND p.status = ? "
            params.append(status)
        if scenario:
            sql += "AND s.key = ? "
            params.append(scenario)
        if keyword:
            sql += "AND p.name LIKE ? "
            params.append(f"%{keyword}%")
        sql += "ORDER BY s.sort_order, s.id, p.id"
        rows = get_db().execute(sql, params).fetchall()
        data = []
        for row in rows:
            item = dict(row)
            item["aliases"] = json.loads(item.get("aliases") or "[]")
            item["billing_modes"] = json.loads(item.get("billing_modes") or '["prepaid","postpaid"]')
            data.append(item)
        return jsonify({"code": 0, "data": data})

    @app.post("/api/products")
    @require_role("business", "admin")
    def api_products_create():
        body = request.get_json(silent=True) or {}
        name = (body.get("name") or "").strip()
        scenario_id = body.get("scenario_id")
        if not name or not scenario_id:
            return jsonify({"code": 400, "msg": "name 和 scenario_id 必填"}), 400
        aliases = json.dumps(body.get("aliases") or [], ensure_ascii=False)
        db = get_db()
        try:
            cur = db.execute(
                "INSERT INTO products(scenario_id, name, name_normalized, aliases, source) "
                "VALUES (?, ?, ?, ?, 'manual')",
                (scenario_id, name, normalize_name(name), aliases),
            )
            product_id = cur.lastrowid
            db.execute(
                "INSERT INTO pricing_rules(product_id) VALUES (?)",
                (product_id,),
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            return jsonify({"code": 500, "msg": f"新增失败：{exc}"}), 500
        return jsonify({"code": 0, "data": {"id": product_id}})

    @app.put("/api/products/<int:product_id>")
    @require_role("business", "admin")
    def api_products_update(product_id):
        body = request.get_json(silent=True) or {}
        name = (body.get("name") or "").strip()
        scenario_id = body.get("scenario_id")
        aliases = json.dumps(body.get("aliases") or [], ensure_ascii=False)
        if not name or not scenario_id:
            return jsonify({"code": 400, "msg": "name 和 scenario_id 必填"}), 400
        db = get_db()
        db.execute(
            "UPDATE products SET name=?, name_normalized=?, scenario_id=?, aliases=?, "
            "updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (name, normalize_name(name), scenario_id, aliases, product_id),
        )
        db.commit()
        return jsonify({"code": 0})

    @app.delete("/api/products/<int:product_id>")
    @require_role("business", "admin")
    def api_products_delete(product_id):
        db = get_db()
        # rule_history 无外键，先手动清
        db.execute("DELETE FROM rule_history WHERE product_id=?", (product_id,))
        # pricing_rules / industry_products 走 ON DELETE CASCADE
        db.execute("DELETE FROM products WHERE id=?", (product_id,))
        db.commit()
        return jsonify({"code": 0})

    @app.post("/api/products/batch-delete")
    @require_role("business", "admin")
    def api_products_batch_delete():
        body = request.get_json(silent=True) or {}
        ids = [int(x) for x in (body.get("ids") or []) if str(x).isdigit() or isinstance(x, int)]
        if not ids:
            return jsonify({"code": 1, "msg": "ids 不能为空"}), 400
        db = get_db()
        placeholders = ",".join(["?"] * len(ids))
        db.execute(f"DELETE FROM rule_history WHERE product_id IN ({placeholders})", ids)
        db.execute(f"DELETE FROM products WHERE id IN ({placeholders})", ids)
        db.commit()
        return jsonify({"code": 0, "data": {"deleted": len(ids)}})

    @app.put("/api/products/<int:product_id>/rule")
    @require_role("business", "admin")
    def api_rule_update(product_id):
        body = request.get_json(silent=True) or {}
        user = current_user() or {}
        db = get_db()
        old = db.execute(
            "SELECT * FROM pricing_rules WHERE product_id=?", (product_id,)
        ).fetchone()
        fields = {
            "price_type": _normalize_price_type(body.get("price_type")),
            "price_unit": (body.get("price_unit") or "").strip(),
            "normal_discount": (body.get("normal_discount") or "").strip(),
            "normal_commission": (body.get("normal_commission") or "").strip(),
            "breakthrough_discount": (body.get("breakthrough_discount") or "").strip(),
            "breakthrough_commission": (body.get("breakthrough_commission") or "").strip(),
            "billing_modes": json.dumps(_normalize_billing_modes(body.get("billing_modes")), ensure_ascii=False),
            "no_commission": 1 if body.get("no_commission") else 0,
            "remark": (body.get("remark") or "").strip(),
            "updated_by": user.get("username", ""),
        }
        # 计算 diff（只看业务字段，updated_by/at 不算）
        diff_keys = ["price_type", "price_unit", "normal_discount", "normal_commission", "breakthrough_discount",
                 "breakthrough_commission", "billing_modes", "no_commission", "remark"]
        old_dict = dict(old) if old else {}
        diff = {}
        for k in diff_keys:
            old_v = old_dict.get(k, "" if k != "no_commission" else 0)
            new_v = fields[k]
            if str(old_v) != str(new_v):
                diff[k] = {"from": old_v, "to": new_v}
        if diff or not old:
            db.execute(
                "INSERT INTO rule_history(product_id, snapshot, action, actor) VALUES (?, ?, ?, ?)",
                (
                    product_id,
                    json.dumps({"before": old_dict, "after": fields, "diff": diff},
                               ensure_ascii=False, default=str),
                    "update" if old else "create",
                    user.get("username", ""),
                ),
            )
        if old:
            db.execute(
                "UPDATE pricing_rules SET price_type=?, price_unit=?, normal_discount=?, normal_commission=?, "
                "breakthrough_discount=?, breakthrough_commission=?, billing_modes=?, no_commission=?, "
                "remark=?, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE product_id=?",
                (
                    fields["price_type"], fields["price_unit"], fields["normal_discount"], fields["normal_commission"],
                    fields["breakthrough_discount"], fields["breakthrough_commission"],
                    fields["billing_modes"], fields["no_commission"], fields["remark"], fields["updated_by"], product_id,
                ),
            )
        else:
            db.execute(
                "INSERT INTO pricing_rules(product_id, price_type, price_unit, normal_discount, normal_commission, "
                "breakthrough_discount, breakthrough_commission, billing_modes, no_commission, remark, updated_by) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    product_id, fields["price_type"], fields["price_unit"], fields["normal_discount"], fields["normal_commission"],
                    fields["breakthrough_discount"], fields["breakthrough_commission"],
                    fields["billing_modes"], fields["no_commission"], fields["remark"], fields["updated_by"],
                ),
            )
        db.commit()
        return jsonify({"code": 0, "data": {"changed": bool(diff or not old), "diff": diff}})

    # ------- Match -------
    def _normalize_billing_modes(value):
        allowed = {"prepaid", "postpaid"}
        if isinstance(value, str):
            value = [value]
        modes = [x for x in (value or []) if x in allowed]
        return modes or ["prepaid", "postpaid"]

    def _normalize_price_type(value):
        return value if value in {"discount", "fixed_price"} else "discount"

    @app.post("/api/match")
    def api_match():
        body = request.get_json(silent=True) or {}
        names = body.get("names") or []
        if isinstance(names, str):
            names = [names]
        rows = get_db().execute(
            "SELECT p.id, p.name, p.name_normalized, p.aliases, p.scenario_id, "
            "s.label AS scenario_label, COALESCE(r.price_type, 'discount') AS price_type, "
            "COALESCE(r.price_unit, '') AS price_unit, "
            "r.normal_discount, r.normal_commission, r.breakthrough_discount, "
            "r.breakthrough_commission, r.billing_modes, r.no_commission, r.remark "
            "FROM products p "
            "LEFT JOIN scenarios s ON s.id = p.scenario_id "
            "LEFT JOIN pricing_rules r ON r.product_id = p.id "
            "WHERE p.status='active'"
        ).fetchall()
        catalog = []
        for row in rows:
            item = dict(row)
            item["aliases"] = json.loads(item.get("aliases") or "[]")
            item["billing_modes"] = json.loads(item.get("billing_modes") or '["prepaid","postpaid"]')
            catalog.append(item)

        results = []
        for raw in names:
            results.append(match_one(raw, catalog))
        return jsonify({"code": 0, "data": results})

    @app.post("/api/match/missing")
    def api_match_missing():
        body = request.get_json(silent=True) or {}
        name = (body.get("name") or "").strip()
        if not name:
            return jsonify({"code": 400, "msg": "name 必填"}), 400
        db = get_db()
        db.execute(
            "INSERT INTO missing_products(raw_name) VALUES (?)",
            (name,),
        )
        db.commit()
        return jsonify({"code": 0})

    @app.get("/api/match/missing")
    @require_role("business", "admin")
    def api_match_missing_list():
        rows = get_db().execute(
            "SELECT id, raw_name, reported_at, resolved FROM missing_products "
            "WHERE resolved=0 ORDER BY reported_at DESC LIMIT 200"
        ).fetchall()
        return jsonify({"code": 0, "data": [dict(row) for row in rows]})

    # ------- Industry → Products mapping -------
    def _industry_names():
        return [r["name"] for r in get_db().execute(
            "SELECT name FROM industries ORDER BY sort_order, id"
        ).fetchall()]

    @app.get("/api/industries")
    def api_industries():
        db = get_db()
        rows = db.execute(
            "SELECT i.id, i.name, i.sort_order, "
            "(SELECT COUNT(*) FROM industry_products ip WHERE ip.industry_key = i.name) AS cnt "
            "FROM industries i ORDER BY i.sort_order, i.id"
        ).fetchall()
        data = [{"id": r["id"], "key": r["name"], "label": r["name"], "sort_order": r["sort_order"], "count": r["cnt"]} for r in rows]
        return jsonify({"code": 0, "data": data})

    @app.post("/api/industries")
    @require_role("admin")
    def api_industries_create():
        body = request.get_json(silent=True) or {}
        name = (body.get("name") or "").strip()
        if not name:
            return jsonify({"code": 400, "msg": "行业名必填"}), 400
        db = get_db()
        try:
            order_row = db.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS o FROM industries").fetchone()
            db.execute("INSERT INTO industries(name, sort_order) VALUES (?, ?)", (name, order_row["o"]))
            db.commit()
        except sqlite3.IntegrityError:
            return jsonify({"code": 409, "msg": "该行业已存在"}), 409
        return jsonify({"code": 0})

    @app.put("/api/industries/<int:ind_id>")
    @require_role("admin")
    def api_industries_update(ind_id):
        body = request.get_json(silent=True) or {}
        name = (body.get("name") or "").strip()
        if not name:
            return jsonify({"code": 400, "msg": "行业名必填"}), 400
        db = get_db()
        old = db.execute("SELECT name FROM industries WHERE id=?", (ind_id,)).fetchone()
        if not old:
            return jsonify({"code": 404, "msg": "行业不存在"}), 404
        try:
            db.execute("UPDATE industries SET name=? WHERE id=?", (name, ind_id))
            # 同步重命名 industry_products 引用
            if old["name"] != name:
                db.execute("UPDATE industry_products SET industry_key=? WHERE industry_key=?", (name, old["name"]))
            db.commit()
        except sqlite3.IntegrityError:
            return jsonify({"code": 409, "msg": "重名冲突"}), 409
        return jsonify({"code": 0})

    @app.delete("/api/industries/<int:ind_id>")
    @require_role("admin")
    def api_industries_delete(ind_id):
        db = get_db()
        row = db.execute("SELECT name FROM industries WHERE id=?", (ind_id,)).fetchone()
        if not row:
            return jsonify({"code": 404, "msg": "行业不存在"}), 404
        db.execute("DELETE FROM industry_products WHERE industry_key=?", (row["name"],))
        db.execute("DELETE FROM industries WHERE id=?", (ind_id,))
        db.commit()
        return jsonify({"code": 0})

    @app.put("/api/industries/reorder")
    @require_role("admin")
    def api_industries_reorder():
        body = request.get_json(silent=True) or {}
        ids = body.get("ids") or []
        if not isinstance(ids, list):
            return jsonify({"code": 400, "msg": "ids 必须是数组"}), 400
        db = get_db()
        for idx, iid in enumerate(ids):
            db.execute("UPDATE industries SET sort_order=? WHERE id=?", (idx, int(iid)))
        db.commit()
        return jsonify({"code": 0})

    @app.get("/api/industry-products")
    def api_industry_products_all():
        """前端启动时拉一次：返回 {industry_key: [product_id, ...]} 完整映射"""
        rows = get_db().execute(
            "SELECT industry_key, product_id FROM industry_products ORDER BY industry_key, sort_order, id"
        ).fetchall()
        result = {}
        for r in rows:
            result.setdefault(r["industry_key"], []).append(r["product_id"])
        return jsonify({"code": 0, "data": result})

    @app.get("/api/industries/<path:industry_key>/products")
    @require_role("business", "admin")
    def api_industry_products_one(industry_key):
        rows = get_db().execute(
            "SELECT product_id FROM industry_products WHERE industry_key=? ORDER BY sort_order, id",
            (industry_key,),
        ).fetchall()
        return jsonify({"code": 0, "data": [r["product_id"] for r in rows]})

    @app.put("/api/industries/<path:industry_key>/products")
    @require_role("admin")
    def api_industry_products_save(industry_key):
        body = request.get_json(silent=True) or {}
        ids = body.get("product_ids") or []
        if not isinstance(ids, list):
            return jsonify({"code": 400, "msg": "product_ids 必须是数组"}), 400
        if industry_key not in _industry_names():
            return jsonify({"code": 400, "msg": "未知行业"}), 400
        ids = [int(x) for x in ids]
        db = get_db()
        # 计算 diff
        before = [r["product_id"] for r in db.execute(
            "SELECT product_id FROM industry_products WHERE industry_key=? ORDER BY sort_order, id",
            (industry_key,),
        ).fetchall()]
        before_set, after_set = set(before), set(ids)
        added_ids = [pid for pid in ids if pid not in before_set]
        removed_ids = [pid for pid in before if pid not in after_set]
        # 查名字
        def _names(id_list):
            if not id_list:
                return []
            placeholders = ",".join("?" * len(id_list))
            rows = db.execute(
                f"SELECT id, name FROM products WHERE id IN ({placeholders})", id_list
            ).fetchall()
            name_map = {r["id"]: r["name"] for r in rows}
            return [{"id": pid, "name": name_map.get(pid, f"#{pid}")} for pid in id_list]
        added = _names(added_ids)
        removed = _names(removed_ids)
        try:
            db.execute("DELETE FROM industry_products WHERE industry_key=?", (industry_key,))
            for idx, pid in enumerate(ids):
                db.execute(
                    "INSERT INTO industry_products(industry_key, product_id, sort_order) VALUES (?, ?, ?)",
                    (industry_key, pid, idx),
                )
            # 仅当发生变化时写日志
            if added or removed:
                user = current_user() or {}
                db.execute(
                    "INSERT INTO industry_change_log(industry_key, added, removed, before_ids, after_ids, actor) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        industry_key,
                        json.dumps(added, ensure_ascii=False),
                        json.dumps(removed, ensure_ascii=False),
                        json.dumps(before, ensure_ascii=False),
                        json.dumps(ids, ensure_ascii=False),
                        user.get("username", ""),
                    ),
                )
            db.commit()
        except Exception as exc:
            db.rollback()
            return jsonify({"code": 500, "msg": f"保存失败：{exc}"}), 500
        return jsonify({"code": 0, "data": {
            "saved": len(ids),
            "added": added,
            "removed": removed,
            "changed": bool(added or removed),
        }})

    @app.get("/api/industries/change-log")
    @require_role("admin")
    def api_industry_change_log():
        key = request.args.get("industry_key", "").strip()
        limit = min(int(request.args.get("limit", 100) or 100), 500)
        sql = "SELECT id, industry_key, added, removed, actor, created_at FROM industry_change_log "
        params = []
        if key:
            sql += "WHERE industry_key=? "
            params.append(key)
        sql += "ORDER BY created_at DESC, id DESC LIMIT ?"
        params.append(limit)
        rows = get_db().execute(sql, params).fetchall()
        data = []
        for r in rows:
            d = dict(r)
            d["added"] = json.loads(d.get("added") or "[]")
            d["removed"] = json.loads(d.get("removed") or "[]")
            data.append(d)
        return jsonify({"code": 0, "data": data})

    @app.get("/api/rule-history")
    @require_role("admin")
    def api_rule_history():
        product_id = request.args.get("product_id", "").strip()
        limit = min(int(request.args.get("limit", 200) or 200), 500)
        sql = (
            "SELECT h.id, h.product_id, h.snapshot, h.action, h.actor, h.created_at, "
            "p.name AS product_name "
            "FROM rule_history h LEFT JOIN products p ON p.id = h.product_id "
        )
        params = []
        if product_id:
            sql += "WHERE h.product_id=? "
            params.append(int(product_id))
        sql += "ORDER BY h.created_at DESC, h.id DESC LIMIT ?"
        params.append(limit)
        out = []
        for r in get_db().execute(sql, params).fetchall():
            d = dict(r)
            try:
                snap = json.loads(d.get("snapshot") or "{}")
            except Exception:
                snap = {}
            # 兼容老格式（snapshot 直接是 pricing_rules dict）
            if isinstance(snap, dict) and ("diff" in snap or "after" in snap or "before" in snap):
                d["before"] = snap.get("before") or {}
                d["after"] = snap.get("after") or {}
                d["diff"] = snap.get("diff") or {}
            else:
                d["before"] = snap if isinstance(snap, dict) else {}
                d["after"] = {}
                d["diff"] = {}
            d.pop("snapshot", None)
            out.append(d)
        return jsonify({"code": 0, "data": out})

    return app


def match_one(raw_name: str, catalog: list) -> dict:
    norm = normalize_name(raw_name)
    if not norm:
        return {"input": raw_name, "matched": None, "candidates": [], "confidence": 0}

    # 精确名
    for item in catalog:
        if item["name"] == raw_name:
            return _format_match(raw_name, item, 1.0)
        if raw_name in item["aliases"]:
            return _format_match(raw_name, item, 0.95)
    # 归一化
    for item in catalog:
        if item["name_normalized"] == norm:
            return _format_match(raw_name, item, 0.9)
        for alias in item["aliases"]:
            if normalize_name(alias) == norm:
                return _format_match(raw_name, item, 0.88)
    # 模糊
    scored = []
    for item in catalog:
        sim = similarity(norm, item["name_normalized"])
        jac = jaccard(raw_name, item["name"])
        score = 0.6 * sim + 0.4 * jac
        if score >= 0.55:
            scored.append((score, item))
    scored.sort(key=lambda x: -x[0])
    if scored and scored[0][0] >= 0.75:
        score, item = scored[0]
        return _format_match(raw_name, item, round(score, 3))
    candidates = [_format_candidate(item, round(s, 3)) for s, item in scored[:3]]
    return {"input": raw_name, "matched": None, "candidates": candidates, "confidence": 0}


def _format_match(raw_name, item, confidence):
    return {
        "input": raw_name,
        "matched": _format_candidate(item, confidence),
        "candidates": [],
        "confidence": confidence,
    }


def _format_candidate(item, confidence):
    return {
        "id": item["id"],
        "name": item["name"],
        "scenario_id": item["scenario_id"],
        "scenario_label": item["scenario_label"],
        "price_type": item["price_type"] or "discount",
        "price_unit": item["price_unit"] or "",
        "normal_discount": item["normal_discount"] or "",
        "normal_commission": item["normal_commission"] or "",
        "breakthrough_discount": item["breakthrough_discount"] or "",
        "breakthrough_commission": item["breakthrough_commission"] or "",
        "no_commission": bool(item["no_commission"]),
        "remark": item["remark"] or "",
        "confidence": confidence,
    }


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
