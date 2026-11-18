#!/usr/bin/env python3
"""Local email catcher for tests: saves every email as an .eml file.  python3 tests/smtp_catch.py /tmp/mail"""
import os, sys, time
from aiosmtpd.controller import Controller

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/mail"
os.makedirs(OUT, exist_ok=True)


class Save:
    async def handle_DATA(self, server, session, envelope):
        with open(os.path.join(OUT, f"{time.time():.6f}.eml"), "wb") as f:
            f.write(envelope.content)
        return "250 OK"


Controller(Save(), hostname="127.0.0.1", port=2525).start()
print(f"catching email on 127.0.0.1:2525 → {OUT}", flush=True)
while True:
    time.sleep(3600)
