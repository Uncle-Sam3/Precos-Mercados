# Gera capturas de tela do site local (python3 tools_screenshot.py) — requer ./serve.sh rodando em :8080
import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True)
        pg = await b.new_page(viewport={"width": 1500, "height": 900})
        logs = []; pg.on("console", lambda m: logs.append(m.text)); pg.on("pageerror", lambda e: logs.append("ERRO " + str(e)))
        await pg.goto("http://localhost:8080/", wait_until="networkidle"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path="screenshot_mapa.png")
        # busca de cidade
        await pg.click("#gopen"); await pg.wait_for_timeout(500)
        await pg.fill("#gq", "Porto Alegre"); await pg.wait_for_timeout(400)
        await pg.screenshot(path="screenshot_busca_cidade.png")
        await pg.press("#gq", "Enter"); await pg.wait_for_timeout(3500)
        await pg.screenshot(path="screenshot_cidade.png")
        # abre uma loja (primeiro marcador visível) e pesquisa
        await pg.evaluate("""() => { const W = innerWidth, H = innerHeight;
          const els = [...document.querySelectorAll('.leaflet-marker-icon[title*="Zaffari"]')].filter(e => { const r = e.getBoundingClientRect(); return r.x > 100 && r.x < W - 500 && r.y > 60 && r.y < H - 60; });
          (els[0] || document.querySelector('.leaflet-marker-icon[title*="Zaffari"]')).click(); }""")
        await pg.wait_for_timeout(800)
        await pg.fill("#q", sys.argv[1] if len(sys.argv) > 1 else "oleo de oliva+salgadinho+bolacha"); await pg.press("#q", "Enter")
        await pg.wait_for_timeout(5000)
        await pg.locator(".card").first.click(); await pg.wait_for_timeout(800)
        rows = pg.locator(".list .row")
        n = await rows.count()
        for i in range(min(n, 30)):
            t = await rows.nth(i).inner_text()
            if "registros" in t: await rows.nth(i).click(); break
        else:
            if n: await rows.first.click()
        await pg.wait_for_timeout(800)
        await pg.screenshot(path="screenshot.png")
        print("\n".join(logs[-20:]))
        await b.close()
asyncio.run(main())
