"""Sprint5 第三批 — 多模态数据产品（Iceberg ADS）live 取证。

链路（无 mock，全部真实服务）：
  1. 网关登录（admin/admin123）→ JWT
  2. 真实 PNG 上传 mate-minio mate-warehouse bucket（object key）
  3. iceberg catalog 建元数据表 + 写入图像行（Trino JDBC metastore）
  4. POST /api/v1/data/products（modality=mixed, target_iceberg_table=…）
  5. POST /api/v1/data/products/{id}/publish → status=published

用法：.venv/Scripts/python scripts/smoke_sprint5_multimodal_ads.py
"""

from __future__ import annotations

import io
import json
import struct
import sys
import urllib.request
import zlib

GW = "http://localhost:8100"
MINIO = "localhost:9000"
ACCESS, SECRET = "meta", "metasecretkey123"
BUCKET = "mate-warehouse"
TENANT = "tenant-default"


def _png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    """生成最小合法 PNG（纯色）。"""
    raw = b"".join(b"\x00" + bytes(rgb) * width for _ in range(height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def http(method: str, url: str, body: dict | None = None, token: str | None = None) -> dict:
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("X-Tenant-Id", TENANT)
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(req, data=data, timeout=60) as r:
        return json.loads(r.read().decode())


def main() -> int:
    # 1. 登录
    tok = http(
        "POST", f"{GW}/api/v1/iam/auth/login", {"username": "admin", "password": "admin123"}
    )["accessToken"]
    print("[1] login OK")

    # 2. 上传图像到 MinIO
    from minio import Minio

    mc = Minio(MINIO, access_key=ACCESS, secret_key=SECRET, secure=False)
    assert mc.bucket_exists(BUCKET), f"bucket {BUCKET} missing"
    images = []
    for _i, (title, rgb, wh) in enumerate(
        [
            ("red-square", (220, 40, 40), (64, 64)),
            ("green-square", (40, 200, 60), (96, 48)),
            ("blue-square", (40, 60, 220), (48, 96)),
        ]
    ):
        key = f"multimodal/ads/{title}.png"
        payload = _png(*wh, rgb)
        mc.put_object(BUCKET, key, io.BytesIO(payload), len(payload), content_type="image/png")
        stat = mc.stat_object(BUCKET, key)
        images.append(
            {"key": key, "title": title, "width": wh[0], "height": wh[1], "size_bytes": stat.size}
        )
    print(f"[2] minio images uploaded: {[im['key'] for im in images]}")

    # 3. iceberg 元数据表
    sys.path.insert(0, "scripts")
    from trino_query import query

    query("CREATE SCHEMA IF NOT EXISTS iceberg.multimodal")
    query("DROP TABLE IF EXISTS iceberg.multimodal.ads_image_catalog")
    query(
        "CREATE TABLE iceberg.multimodal.ads_image_catalog "
        "(image_key varchar, title varchar, width integer, height integer, "
        "size_bytes bigint)"
    )
    for im in images:
        query(
            "INSERT INTO iceberg.multimodal.ads_image_catalog VALUES "
            f"('{im['key']}', '{im['title']}', {im['width']}, "
            f"{im['height']}, {im['size_bytes']})"
        )
    rows = query("SELECT image_key, title FROM iceberg.multimodal.ads_image_catalog ORDER BY title")
    print(f"[3] iceberg rows: {rows['rows']}")

    # 4. 创建 modality=mixed 产品
    prod = http(
        "POST",
        f"{GW}/api/v1/data/products",
        {
            "name": "multimodal-image-ads",
            "source_paimon_table": "minio://mate-warehouse/multimodal/raw",
            "target_iceberg_table": "iceberg.multimodal.ads_image_catalog",
            "modality": "mixed",
            "owner": "admin",
            "description": "Sprint5 multimodal ADS: MinIO image object keys + "
            "iceberg metadata table",
            "tags": ["sprint5", "multimodal", "ads"],
        },
        token=tok,
    )
    pid = prod["id"]
    print(f"[4] product created: id={pid} modality={prod['modality']} status={prod['status']}")

    # 5. 发布
    pub = http("POST", f"{GW}/api/v1/data/products/{pid}/publish", {}, token=tok)
    print(f"[5] published: status={pub['status']} version={pub['version']}")

    detail = http("GET", f"{GW}/api/v1/data/products/{pid}", token=tok)
    assert detail["status"] == "published", detail
    assert detail["modality"] == "mixed", detail
    print("[PASS] multimodal Iceberg ADS product published")
    print(
        json.dumps(
            {
                "product_id": pid,
                "iceberg_rows": rows["rows"],
                "images": [im["key"] for im in images],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
