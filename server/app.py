import json
import os
import sqlite3
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

    # ------- Products -------
    @app.get("/api/products")
    def api_products_list():
        scenario = request.args.get("scenario")
        keyword = (request.args.get("q") or "").strip()
        status = request.args.get("status", "active")
        sql = (
            "SELECT p.id, p.scenario_id, s.label AS scenario_label, p.name, p.aliases, "
            "p.status, p.source, p.updated_at, "
            "r.normal_discount, r.normal_commission, r.breakthrough_discount, "
            "r.breakthrough_commission, r.no_commission, r.remark, r.updated_by, r.updated_at AS rule_updated_at "
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
        db.execute(
            "UPDATE products SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (product_id,),
        )
        db.commit()
        return jsonify({"code": 0})

    @app.put("/api/products/<int:product_id>/rule")
    @require_role("business", "admin")
    def api_rule_update(product_id):
        body = request.get_json(silent=True) or {}
        user = current_user() or {}
        db = get_db()
        old = db.execute(
            "SELECT * FROM pricing_rules WHERE product_id=?", (product_id,)
        ).fetchone()
        if old:
            db.execute(
                "INSERT INTO rule_history(product_id, snapshot, action, actor) VALUES (?, ?, 'update', ?)",
                (product_id, json.dumps(dict(old), ensure_ascii=False, default=str), user.get("username", "")),
            )
        fields = {
            "normal_discount": (body.get("normal_discount") or "").strip(),
            "normal_commission": (body.get("normal_commission") or "").strip(),
            "breakthrough_discount": (body.get("breakthrough_discount") or "").strip(),
            "breakthrough_commission": (body.get("breakthrough_commission") or "").strip(),
            "no_commission": 1 if body.get("no_commission") else 0,
            "remark": (body.get("remark") or "").strip(),
            "updated_by": user.get("username", ""),
        }
        if old:
            db.execute(
                "UPDATE pricing_rules SET normal_discount=?, normal_commission=?, "
                "breakthrough_discount=?, breakthrough_commission=?, no_commission=?, "
                "remark=?, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE product_id=?",
                (
                    fields["normal_discount"], fields["normal_commission"],
                    fields["breakthrough_discount"], fields["breakthrough_commission"],
                    fields["no_commission"], fields["remark"], fields["updated_by"], product_id,
                ),
            )
        else:
            db.execute(
                "INSERT INTO pricing_rules(product_id, normal_discount, normal_commission, "
                "breakthrough_discount, breakthrough_commission, no_commission, remark, updated_by) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    product_id, fields["normal_discount"], fields["normal_commission"],
                    fields["breakthrough_discount"], fields["breakthrough_commission"],
                    fields["no_commission"], fields["remark"], fields["updated_by"],
                ),
            )
        db.commit()
        return jsonify({"code": 0})

    # ------- Match -------
    @app.post("/api/match")
    def api_match():
        body = request.get_json(silent=True) or {}
        names = body.get("names") or []
        if isinstance(names, str):
            names = [names]
        rows = get_db().execute(
            "SELECT p.id, p.name, p.name_normalized, p.aliases, p.scenario_id, "
            "s.label AS scenario_label, "
            "r.normal_discount, r.normal_commission, r.breakthrough_discount, "
            "r.breakthrough_commission, r.no_commission, r.remark "
            "FROM products p "
            "LEFT JOIN scenarios s ON s.id = p.scenario_id "
            "LEFT JOIN pricing_rules r ON r.product_id = p.id "
            "WHERE p.status='active'"
        ).fetchall()
        catalog = []
        for row in rows:
            item = dict(row)
            item["aliases"] = json.loads(item.get("aliases") or "[]")
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
