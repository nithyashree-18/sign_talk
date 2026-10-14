"""Builds a one-page certificate PDF with no extra packages (plain PDF syntax).
The same code is copied into aws/certificate_lambda.py so the Lambda needs no layers."""

# Character widths (per 1000 units) of the three built-in PDF fonts, so text can be centred exactly.
def _table(lower, upper, digit, extra, default):
    t = {c: w for c, w in zip("abcdefghijklmnopqrstuvwxyz", lower)}
    t.update({c: w for c, w in zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", upper)})
    t.update({d: digit for d in "0123456789"})
    t.update(extra)
    t["_"] = default
    return t


_WIDTHS = {
    "F1": _table(  # Helvetica
        [556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500],
        [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611],
        556, {" ": 278, ".": 278, ",": 278, ":": 278, "-": 333, "(": 333, ")": 333}, 556),
    "F2": _table(  # Helvetica-Bold
        [556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500],
        [722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611],
        556, {" ": 278, ".": 278, ",": 278, ":": 333, "-": 333, "(": 333, ")": 333}, 600),
    "F3": _table(  # Times-Bold
        [500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444],
        [722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667],
        500, {" ": 250, ".": 250, ",": 250, ":": 333, "-": 333, "(": 333, ")": 333}, 500),
}


def _width(s, font, size):
    t = _WIDTHS[font]
    return sum(t.get(c, t["_"]) for c in str(s)) * size / 1000


def _esc(s):
    s = str(s).encode("latin-1", "replace").decode("latin-1")
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_certificate_pdf(name, exam_title, score, total, date, cert_id):
    W, H = 842, 595  # A4 landscape, in points
    parts = []

    def text(cx, y, s, font, size, rgb=(0.1, 0.14, 0.13)):
        width = _width(s, font, size)
        r, g, b = rgb
        parts.append(
            f"BT {r} {g} {b} rg /{font} {size} Tf {cx - width / 2:.1f} {y} Td ({_esc(s)}) Tj ET"
        )

    parts.append("0.97 0.96 0.93 rg 0 0 842 595 re f")                      # paper
    parts.append("0.06 0.30 0.23 RG 6 w 28 28 786 539 re S")                # outer border
    parts.append("0.78 0.45 0.10 RG 1.5 w 40 40 762 515 re S")              # inner border
    text(W / 2, 480, "SIGN TALK", "F2", 18, (0.06, 0.30, 0.23))
    text(W / 2, 430, "Certificate of Achievement", "F3", 40)
    text(W / 2, 385, "This is to certify that", "F1", 15, (0.36, 0.41, 0.40))
    text(W / 2, 330, name, "F3", 36, (0.06, 0.30, 0.23))
    text(W / 2, 290, "has passed the practical examination", "F1", 15, (0.36, 0.41, 0.40))
    text(W / 2, 255, exam_title, "F2", 20)
    text(W / 2, 215, f"Score: {score} out of {total}", "F1", 16)
    text(W / 2, 110, f"Issued on {date}", "F1", 12, (0.36, 0.41, 0.40))
    text(W / 2, 90, f"Certificate ID: {cert_id}", "F1", 12, (0.36, 0.41, 0.40))
    text(W / 2, 68, "Indian Sign Language learning, with automatic webcam scoring", "F1", 10, (0.36, 0.41, 0.40))
    stream = "\n".join(parts).encode("latin-1")

    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 7 0 R "
        b"/Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)
