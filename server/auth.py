from functools import wraps
from flask import session, jsonify
from .db import get_db


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    row = get_db().execute("SELECT id, username, role FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def require_role(*roles):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"code": 401, "msg": "需要登录"}), 401
            if roles and user["role"] not in roles:
                return jsonify({"code": 403, "msg": "权限不足"}), 403
            return func(*args, **kwargs)

        return wrapper

    return decorator
