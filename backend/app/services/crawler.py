import ipaddress
import re
import socket
from collections import deque
from dataclasses import dataclass
from pathlib import PurePosixPath
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup


MAX_HTML_BYTES = 2_000_000
MAX_REDIRECTS = 5

SKIPPED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".pdf",
    ".zip",
    ".rar",
    ".mp4",
    ".mp3",
    ".css",
    ".js",
    ".xml",
}


class UnsafeURLError(Exception):
    pass


class CrawlerError(Exception):
    pass


@dataclass
class CrawledPage:
    url: str
    title: str | None
    status_code: int
    content: str
    links: list[str]


def validate_public_url(url: str) -> None:
    parsed = urlsplit(url)

    if parsed.scheme not in {"http", "https"}:
        raise UnsafeURLError(
            "Only http and https URLs are allowed."
        )

    if not parsed.hostname:
        raise UnsafeURLError(
            "URL must contain a hostname."
        )

    try:
        addresses = socket.getaddrinfo(
            parsed.hostname,
            None,
        )
    except socket.gaierror as exc:
        raise UnsafeURLError(
            "Hostname could not be resolved."
        ) from exc

    for address in addresses:
        ip_string = address[4][0]
        ip = ipaddress.ip_address(ip_string)

        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise UnsafeURLError(
                "Private or local network URLs are not allowed."
            )


def normalize_url(url: str) -> str:
    parsed = urlsplit(url)

    scheme = parsed.scheme.lower()
    hostname = (parsed.hostname or "").lower()

    if parsed.port:
        netloc = f"{hostname}:{parsed.port}"
    else:
        netloc = hostname

    path = parsed.path or "/"

    if path != "/":
        path = path.rstrip("/")

    return urlunsplit(
        (
            scheme,
            netloc,
            path,
            "",
            "",
        )
    )


def should_skip_url(url: str) -> bool:
    parsed = urlsplit(url)

    extension = PurePosixPath(
        parsed.path
    ).suffix.lower()

    return extension in SKIPPED_EXTENSIONS


def is_same_hostname(
    url: str,
    hostname: str,
) -> bool:
    parsed = urlsplit(url)

    return (
        parsed.hostname or ""
    ).lower() == hostname.lower()

def extract_content(
    html: str,
    page_url: str,
) -> tuple[str | None, str, list[str]]:

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    # --------------------------------------------------
    # 1. Discover links BEFORE removing nav/header/footer
    # --------------------------------------------------

    discovered_links: set[str] = set()

    for anchor in soup.find_all(
        "a",
        href=True,
    ):
        href = anchor.get("href")

        if not href:
            continue

        absolute_url = urljoin(
            page_url,
            href,
        )

        parsed = urlsplit(
            absolute_url
        )

        if parsed.scheme not in {
            "http",
            "https",
        }:
            continue

        normalized_url = normalize_url(
            absolute_url
        )

        discovered_links.add(
            normalized_url
        )

    # --------------------------------------------------
    # 2. Extract page title
    # --------------------------------------------------

    title = None

    if soup.title:
        title = soup.title.get_text(
            " ",
            strip=True,
        )

    # --------------------------------------------------
    # 3. Remove obvious non-content elements
    # --------------------------------------------------

    for tag in soup(
        [
            "script",
            "style",
            "noscript",
            "svg",
            "template",
            "nav",
            "footer",
            "header",
            "aside",
            "form",
            "button",
        ]
    ):
        tag.decompose()

    # --------------------------------------------------
    # 4. Remove common noisy sections
    # --------------------------------------------------

    noisy_keywords = {
        "cookie",
        "popup",
        "modal",
        "newsletter",
        "sidebar",
        "breadcrumb",
    }

    elements = list(
        soup.find_all(True)
    )

    for element in elements:

        # Element may already have been destroyed
        # because a parent element was decomposed.
        if element.attrs is None:
            continue

        classes = element.get(
            "class",
            [],
        )

        # Normally BeautifulSoup returns a list,
        # but handle strings safely too.
        if isinstance(
            classes,
            str,
        ):
            classes = [classes]

        class_text = " ".join(
            classes
        ).lower()

        element_id = (
            element.get("id")
            or ""
        ).lower()

        descriptor = (
            f"{class_text} {element_id}"
        )

        if any(
            keyword in descriptor
            for keyword in noisy_keywords
        ):
            element.decompose()

    # --------------------------------------------------
    # 5. Prefer real content containers
    # --------------------------------------------------

    root = (
        soup.find("main")
        or soup.find("article")
        or soup.body
        or soup
    )

    raw_text = root.get_text(
        separator="\n",
        strip=True,
    )

    # --------------------------------------------------
    # 6. Clean whitespace + remove duplicate lines
    # --------------------------------------------------

    lines: list[str] = []

    seen_lines: set[str] = set()

    for line in raw_text.splitlines():

        cleaned = re.sub(
            r"\s+",
            " ",
            line,
        ).strip()

        if not cleaned:
            continue

        normalized_line = (
            cleaned.lower()
        )

        if normalized_line in seen_lines:
            continue

        seen_lines.add(
            normalized_line
        )

        lines.append(
            cleaned
        )

    content = "\n".join(
        lines
    )

    # --------------------------------------------------
    # 7. Return extracted data
    # --------------------------------------------------

    return (
        title,
        content,
        list(discovered_links),
    )

def crawl_page(
    url: str,
    client: httpx.Client,
) -> CrawledPage:

    current_url = url

    for _ in range(
        MAX_REDIRECTS + 1
    ):
        validate_public_url(
            current_url
        )

        try:
            with client.stream(
                "GET",
                current_url,
            ) as response:

                if response.status_code in {
                    301,
                    302,
                    303,
                    307,
                    308,
                }:
                    location = (
                        response.headers.get(
                            "location"
                        )
                    )

                    if not location:
                        raise CrawlerError(
                            "Redirect has no location."
                        )

                    current_url = urljoin(
                        current_url,
                        location,
                    )

                    continue

                try:
                    response.raise_for_status()

                except httpx.HTTPStatusError as exc:
                    raise CrawlerError(
                        f"HTTP {response.status_code}"
                    ) from exc

                content_type = (
                    response.headers.get(
                        "content-type",
                        "",
                    ).lower()
                )

                if "text/html" not in content_type:
                    raise CrawlerError(
                        "URL did not return HTML."
                    )

                chunks = []
                total_size = 0

                for chunk in response.iter_bytes():
                    total_size += len(
                        chunk
                    )

                    if (
                        total_size
                        > MAX_HTML_BYTES
                    ):
                        raise CrawlerError(
                            "Page exceeds crawl size limit."
                        )

                    chunks.append(
                        chunk
                    )

                html_bytes = b"".join(
                    chunks
                )

                encoding = (
                    response.encoding
                    or "utf-8"
                )

                html = html_bytes.decode(
                    encoding,
                    errors="replace",
                )

                final_url = normalize_url(
                    str(response.url)
                )

                (
                    title,
                    content,
                    links,
                ) = extract_content(
                    html,
                    final_url,
                )

                return CrawledPage(
                    url=final_url,
                    title=title,
                    status_code=response.status_code,
                    content=content,
                    links=links,
                )

        except httpx.RequestError as exc:
            raise CrawlerError(
                f"Could not fetch page: {exc}"
            ) from exc

    raise CrawlerError(
        "Too many redirects."
    )

def crawl_website(
    start_url: str,
    max_pages: int = 10,
) -> tuple[list[CrawledPage], list[str]]:

    crawled_pages: list[CrawledPage] = []
    failed_urls: list[str] = []

    queue = deque(
        [normalize_url(start_url)]
    )

    visited: set[str] = set()

    allowed_hostname: str | None = None

    headers = {
        "User-Agent": "SEOAutomationBot/0.1"
    }

    with httpx.Client(
        timeout=10.0,
        headers=headers,
        follow_redirects=False,
    ) as client:

        while (
            queue
            and len(crawled_pages) < max_pages
        ):

            url = queue.popleft()

            if url in visited:
                continue

            visited.add(url)

            if should_skip_url(url):
                continue

            try:
                page = crawl_page(
                    url,
                    client,
                )

            except (
                CrawlerError,
                UnsafeURLError,
            ):
                failed_urls.append(
                    url
                )

                continue

            if allowed_hostname is None:
                allowed_hostname = (
                    urlsplit(
                        page.url
                    ).hostname
                )

                if allowed_hostname is None:
                    raise CrawlerError(
                        "Could not determine website hostname."
                    )

            if not is_same_hostname(
                page.url,
                allowed_hostname,
            ):
                continue

            crawled_pages.append(
                page
            )

            for link in page.links:

                if not is_same_hostname(
                    link,
                    allowed_hostname,
                ):
                    continue

                if should_skip_url(
                    link
                ):
                    continue

                if len(link) > 512:
                    continue

                if link in visited:
                    continue

                if link in queue:
                    continue

                queue.append(
                    link
                )

    return (
        crawled_pages,
        failed_urls,
    )