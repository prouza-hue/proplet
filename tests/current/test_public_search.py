"""Indexing the public game must work before any client-side JavaScript runs."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser
from xml.etree import ElementTree


PUBLIC = Path(__file__).resolve().parents[2] / "public"
ORIGIN = "https://hrajproplet.cz"
HOME = ORIGIN + "/"


class SearchPage(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.links = []
        self.canonicals = []
        self.directives = set()
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "link" and "canonical" in (attrs.get("rel") or "").lower().split():
            self.canonicals.append(attrs.get("href"))
        if tag == "meta" and attrs.get("name", "").lower() in {"robots", "googlebot", "seznambot", "bingbot"}:
            self.directives.update(attrs.get("content", "").lower().replace(",", " ").split())


robots = RobotFileParser()
robots.parse((PUBLIC / "robots.txt").read_text().splitlines())
assert ORIGIN + "/sitemap.xml" in (robots.site_maps() or [])
sitemap = ElementTree.parse(PUBLIC / "sitemap.xml")
announced = {item.text for item in sitemap.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")}
assert HOME in announced
pending, visited = [HOME], set()
while pending:
    url = pending.pop()
    if url in visited:
        continue
    visited.add(url)
    path = urlsplit(url).path.lstrip("/") or "index.html"
    page = SearchPage((PUBLIC / path).read_text(encoding="utf-8"))
    assert page.canonicals == [url], (url, page.canonicals)
    assert not page.directives.intersection({"noindex", "nofollow", "none"}), (url, page.directives)
    for crawler in ("Googlebot", "SeznamBot", "bingbot"):
        assert robots.can_fetch(crawler, url), (crawler, url)
    pending.extend(link for href in page.links if (link := urljoin(url, href)) in announced)
assert visited == announced, f"Public pages missing ordinary HTML links: {announced - visited}"
print(f"PASS {len(visited)} crawlable and internally linked public URLs")
