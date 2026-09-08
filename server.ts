import { createServer, IncomingMessage, ServerResponse } from "node:http";

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const UPSTREAMS = [
  "https://dns.google/dns-query",
  "https://cloudflare-dns.com/dns-query",
];

const DEFAULT_DOH_PATH = "/api/v3/change-me";
const MAX_BODY_SIZE = 65535;
const UPSTREAM_TIMEOUT_MS = 5000;

function normalizePath(input?: string) {
  let path = (input || DEFAULT_DOH_PATH).trim();
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

const HOMEPAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>社会主义核心价值观</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{
  min-height:100vh;
  font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif;
  background:linear-gradient(180deg,#f8f3e9,#fffdf8 50%,#f7f1e7);
  color:#3a2a20
}
.header{
  padding:55px 20px 48px;text-align:center;
  background:linear-gradient(135deg,#950d14,#c31820,#990d14);
  color:#fff
}
.star{
  width:68px;height:68px;margin:0 auto 20px;
  display:flex;align-items:center;justify-content:center;
  border:2px solid #e9c878;border-radius:50%;
  color:#f0d287;font-size:34px
}
h1{margin:0;font-size:46px;letter-spacing:6px;font-weight:700}
.subtitle{margin-top:14px;font-size:13px;letter-spacing:4px;color:#f2dca8}
.main{width:100%;max-width:1050px;margin:auto;padding:50px 25px}
.intro{text-align:center;margin-bottom:34px}
.intro h2{margin:0;font-size:23px;color:#8b171c;letter-spacing:4px}
.intro p{margin-top:14px;color:#806d5c;line-height:1.9}
.values{display:grid;grid-template-columns:repeat(4,1fr);gap:17px}
.value{
  min-height:108px;display:flex;align-items:center;justify-content:center;
  background:#fffdf8;border:1px solid #e4d0a5;border-left:4px solid #a41419;
  box-shadow:0 3px 12px rgba(80,40,10,.06)
}
.value span{
  color:#8d171c;font-family:"KaiTi","STKaiti",serif;
  font-size:30px;font-weight:bold;letter-spacing:5px
}
.slogan{
  margin-top:42px;padding:28px;text-align:center;
  border-top:1px solid #e3d1ac;border-bottom:1px solid #e3d1ac;
  line-height:2;color:#735c48
}
.slogan strong{
  display:block;margin-bottom:10px;color:#8c171c;
  font-size:20px;letter-spacing:3px
}
.footer{
  padding:25px 20px;text-align:center;background:#821015;
  color:#efd18d;font-size:13px;line-height:2;letter-spacing:2px
}
@media(max-width:800px){.values{grid-template-columns:repeat(3,1fr)}}
@media(max-width:600px){
  h1{font-size:31px;letter-spacing:3px}
  .main{padding:35px 18px}
  .values{grid-template-columns:repeat(2,1fr);gap:11px}
  .value{min-height:88px}
  .value span{font-size:25px}
}
</style>
</head>
<body>
<header class="header">
  <div class="star">★</div>
  <h1>社会主义核心价值观</h1>
  <div class="subtitle">CORE SOCIALIST VALUES</div>
</header>
<main class="main">
  <section class="intro">
    <h2>弘扬社会主义核心价值观</h2>
    <p>积极培育和践行社会主义核心价值观，共同营造文明、和谐、诚信、友善的社会环境。</p>
  </section>
  <section class="values">
    <div class="value"><span>富强</span></div>
    <div class="value"><span>民主</span></div>
    <div class="value"><span>文明</span></div>
    <div class="value"><span>和谐</span></div>
    <div class="value"><span>自由</span></div>
    <div class="value"><span>平等</span></div>
    <div class="value"><span>公正</span></div>
    <div class="value"><span>法治</span></div>
    <div class="value"><span>爱国</span></div>
    <div class="value"><span>敬业</span></div>
    <div class="value"><span>诚信</span></div>
    <div class="value"><span>友善</span></div>
  </section>
  <section class="slogan">
    <strong>凝聚价值共识 · 弘扬时代新风</strong>
    富强 · 民主 · 文明 · 和谐<br>
    自由 · 平等 · 公正 · 法治<br>
    爱国 · 敬业 · 诚信 · 友善
  </section>
</main>
<footer class="footer">
富强 · 民主 · 文明 · 和谐 · 自由 · 平等 · 公正 · 法治 · 爱国 · 敬业 · 诚信 · 友善
</footer>
</body>
</html>`;

function writeText(res: ServerResponse, status: number, text: string) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(text);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function fetchUpstream(
  upstream: string,
  method: "GET" | "POST",
  search: string,
  body: Buffer | null
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const target = method === "GET" ? upstream + search : upstream;

    return await fetch(target, {
      method,
      headers: {
        Accept: "application/dns-message",
        ...(method === "POST"
          ? { "Content-Type": "application/dns-message" }
          : {}),
      },
      body: method === "POST" ? body : undefined,
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function shouldFailover(status: number) {
  return status === 429 || status >= 500;
}

async function handleDoh(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = (req.method || "").toUpperCase();

  if (method !== "GET" && method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return writeText(res, 405, "Method Not Allowed");
  }

  if (method === "GET" && !url.searchParams.has("dns")) {
    return writeText(res, 400, "Bad Request");
  }

  let body: Buffer | null = null;

  if (method === "POST") {
    const contentType = (req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();

    if (contentType && contentType !== "application/dns-message") {
      return writeText(res, 415, "Unsupported Media Type");
    }

    try {
      body = await readBody(req);
    } catch {
      return writeText(res, 413, "Payload Too Large");
    }

    if (!body.length) {
      return writeText(res, 400, "Bad Request");
    }
  }

  for (let i = 0; i < UPSTREAMS.length; i++) {
    try {
      const upstreamResponse = await fetchUpstream(
        UPSTREAMS[i],
        method as "GET" | "POST",
        url.search,
        body
      );

      if (shouldFailover(upstreamResponse.status) && i < UPSTREAMS.length - 1) {
        continue;
      }

      const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());

      res.writeHead(upstreamResponse.status, {
        "Content-Type":
          upstreamResponse.headers.get("content-type") ||
          "application/dns-message",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(responseBody);
      return;
    } catch {
      if (i < UPSTREAMS.length - 1) continue;
    }
  }

  return writeText(res, 503, "Service Unavailable");
}

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);
    const dohPath = normalizePath(process.env.DOH_PATH);

    if ((url.pathname === "/" || url.pathname === "/index.html") && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      });
      res.end(HOMEPAGE);
      return;
    }

    if (url.pathname === dohPath) {
      await handleDoh(req, res, url);
      return;
    }

    writeText(res, 404, "Not Found");
  } catch {
    writeText(res, 500, "Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Listening on ${HOST}:${PORT}`);
});
