"""Entrypoint local do laboratório adversarial do PedeJá.

O frontend vive em ``src/views/web`` (React + TypeScript). Em produção local,
`uv run trabalho-2` serve o build estático gerado por ``npm run build`` com a
biblioteca padrão do Python — sem FastAPI, sem segundo processo.

Para desenvolver a interface com recarga imediata, use ``npm run dev`` dentro de
``src/views/web``.
"""

from __future__ import annotations

import argparse
import errno
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DIST_DIR = Path(__file__).resolve().parent / "web" / "dist"
INDEX_FILE = DIST_DIR / "index.html"


class SinglePageHandler(SimpleHTTPRequestHandler):
    """Serve o build do Vite e devolve ``index.html`` nas rotas do app."""

    def __init__(self, *args, **kwargs) -> None:  # type: ignore[no-untyped-def]
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def do_GET(self) -> None:  # noqa: N802 (nome definido pela stdlib)
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        target = DIST_DIR / path.lstrip("/")
        if path in {"", "/"} or not target.exists():
            self.path = "/index.html"
        super().do_GET()

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        print(f"[web] {self.address_string()} {format % args}")


def main(argv: list[str] | None = None) -> None:
    """Inicia o servidor local do frontend."""
    parser = argparse.ArgumentParser(description="Laboratório adversarial do PedeJá")
    parser.add_argument("--host", default="127.0.0.1", help="endereço de escuta (padrão: 127.0.0.1)")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", "8501")),
        help="porta HTTP (padrão: 8501 ou variável PORT)",
    )
    args = parser.parse_args(argv)

    if not INDEX_FILE.is_file():
        raise SystemExit(
            "Build do frontend não encontrado em src/views/web/dist.\n"
            "Execute: cd src/views/web && npm install && npm run build"
        )

    try:
        server = ThreadingHTTPServer((args.host, args.port), SinglePageHandler)
    except OSError as exc:
        if exc.errno == errno.EADDRINUSE:
            raise SystemExit(
                f"A porta {args.port} já está em uso em {args.host}.\n"
                "Encerre o processo que a utiliza ou escolha outra porta com --port."
            ) from exc
        raise
    print(f"PedeJá · laboratório adversarial em http://{args.host}:{args.port}")
    print("Ctrl+C para encerrar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
