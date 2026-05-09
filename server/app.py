import json
import os
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
        if not current_user():
            return redirect(url_for("page_login"))
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
    INDUSTRY_LIST = [
        "漫剧 / 短剧 / AIGC 内容制作",
        "漫画 / 动漫 / 二次元",
        "直播 / 语音房 / 社交",
        "游戏 / 互娱",
        "短视频 / 图文社区",
        "文化传媒 / MCN / 营销",
        "媒资处理 / 视频审核",
        "出海业务 / 海外内容",
        "会议 / IM / 协作",
        "物联网 / 智能硬件",
        "物流 / 交通运输",
        "教育 / 校园安防",
        "医疗 / 健康",
        "电商 / 零售 / SaaS",
        "政企信息化 / 软件开发",
        "金融 / 人脸核身",
        "企业内部 IT / 网盘 / OA",
    ]

    @app.get("/api/industries")
    def api_industries():
        # 同时返回每个行业已配置的产品数，方便后台显示
        db = get_db()
        rows = db.execute(
            "SELECT industry_key, COUNT(*) AS cnt FROM industry_products GROUP BY industry_key"
        ).fetchall()
        counts = {r["industry_key"]: r["cnt"] for r in rows}
        data = [{"key": name, "label": name, "count": counts.get(name, 0)} for name in INDUSTRY_LIST]
        return jsonify({"code": 0, "data": data})

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
        if industry_key not in INDUSTRY_LIST:
            return jsonify({"code": 400, "msg": "未知行业"}), 400
        db = get_db()
        try:
            db.execute("DELETE FROM industry_products WHERE industry_key=?", (industry_key,))
            for idx, pid in enumerate(ids):
                db.execute(
                    "INSERT INTO industry_products(industry_key, product_id, sort_order) VALUES (?, ?, ?)",
                    (industry_key, int(pid), idx),
                )
            db.commit()
        except Exception as exc:
            db.rollback()
            return jsonify({"code": 500, "msg": f"保存失败：{exc}"}), 500
        return jsonify({"code": 0, "data": {"saved": len(ids)}})

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
