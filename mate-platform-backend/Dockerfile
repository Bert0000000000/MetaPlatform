# syntax=docker/dockerfile:1.7
# =============================================================================
# Mate Platform Backend - Multi-stage Dockerfile
# Target image: python:3.12 (full, per architecture: agent.md "Python 闂傚倵鍋撴繝濠傚暙閸? + tech-stack-confirmed.md)
# Entry: mate-tech-rag
# =============================================================================
FROM python:3.12 AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

# 闂傚倷娴囬褍霉閻戣棄绠犻柟鎯у殺閸ヮ剙绠柛?uv
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /usr/local/bin/

WORKDIR /app

# 濠电姷鏁告慨浼村垂閻撳簶鏋栨繛鎴炴皑閻捇鏌熺紒銏犳灈闁?workspace 濠电姷鏁告慨浼村垂閻熷府鑰块弶鍫涘妽濞呯姵淇婇妶鍌氫壕闁?+ 闂傚倸鍊风粈浣革耿闁秲鈧倹绂掔€ｎ亞锛涢梺鐟板⒔缁垶鎮″☉銏＄厱妞ゆ劧绲跨粻銉︿繆閹绘帗璐＄紒杈ㄥ浮閳ワ箓骞嬪┑鍥╁綆闂?COPY pyproject.toml uv.lock ./
COPY packages/ packages/

# 闂傚倷娴囧畷鐢稿窗瀹ュ洨鐭嗗〒姘ｅ亾妤犵偛锕ㄧ粻娑㈠籍閳ь剙鈻嶉悩纰樺亾楠炲灝鍔氭い锔诲灣閳ь剚鑹鹃ˇ顖炩€︾捄銊﹀磯闁惧繐婀遍崝鎼佹⒑缁嬪灝顒㈤柛銊ф暬閸┿儲寰勯幇顒傤啋闂佸綊顣﹂悞锔芥櫏闂傚倷绀侀幖顐︽儔婵傜绐楅柟閭﹀枤缁犳棃鏌ｉ弬璺ㄦ闁衡偓閽樺鏀介柣妯诲絻椤忓瓨绻涘顔煎⒋婵﹥妞介獮鎰償閿濆倹顫嶉梻浣虹帛椤ㄥ懘骞婇幇顔煎灊妞ゆ挾鍠庣欢鐐烘煙闁箑澧茬悮?workspace 濠电姷顣槐鏇㈠磻閹达箑纾归柡鍥╁剳閼板潡鏌涘Δ鍐х闯闁绘垶锚椤曢亶鎮楀☉娅虫垵鈻?RUN uv sync --frozen --no-dev

# 闂?src 闂傚倸鍊烽懗鍫曞磿閻㈢鐤鹃柍鍝勬噹缁愭鏌″搴′簽缂佲偓婵犲嫧鍋撻獮鍨姎妞わ缚鍗冲畷鏇熸償閵婏箑鈧灚绻涢幋鐑嗕痪妞ゅ繐鎳庣欢鐐碘偓骞垮劚閹峰鎮㈤崱娑欏仯濡わ附瀵ч鐘碘偓娑欑箞濮婅櫣鍖栭弴鐔哥彆濡炪們鍔岄敃銈夋偩?venv site-packages闂傚倸鍊烽悞锔锯偓绗涘懐鐭欓柟杈鹃檮閸嬪鐓崶銊︾闁搞劍绻冮妵鍕箛閸撲胶蓱婵?uv workspace 濠电姴鐥夐弶搴撳亾濡や焦鍙忛柟缁㈠枟閸庢銆掑锝呬壕闂佽鍨悞锕€顕ラ崟顖氱疀妞ゆ挾鍠愰悵?RUN SITE=/app/.venv/lib/python3.12/site-packages && \
    cp -r packages/mate-common/src/mate_common "$SITE/" && \
    cp -r packages/mate-tech-rag/src/mate_tech_rag "$SITE/"

# ---------- 闂傚倸鍊搁崐鎼佸磹閹间礁鐤柟鎯版閺勩儵鏌″搴″季闁?2闂傚倸鍊烽悞锔锯偓绗涘懐鐭欓柟鐑橆殢閺佸棝鏌ｉ悢宄扮厫time ----------
FROM python:3.12 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

RUN useradd --create-home --shell /bin/bash appuser
USER appuser
WORKDIR /app

EXPOSE 8001

CMD ["uvicorn", "mate_tech_rag.api.app:app", "--host", "0.0.0.0", "--port", "8001"]