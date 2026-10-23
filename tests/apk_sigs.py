#!/usr/bin/env python3
"""Lists the signing certificates of an APK without any Android tool: APK Signature Scheme v2 and v3 signers, with the SDK range of
each v3 signer and the certificates of the proof of rotation (lineage). SHA-256 of each certificate (DER), as apksigner prints it.
Usage: python3 tests/apk_sigs.py radar-trades.apk"""
import hashlib, struct, sys

def u32(b, o): return struct.unpack_from("<I", b, o)[0]
def u64(b, o): return struct.unpack_from("<Q", b, o)[0]
def seq(b):
    """length-prefixed items (uint32 length) of a byte string"""
    o, out = 0, []
    while o + 4 <= len(b):
        n = u32(b, o); out.append(b[o + 4:o + 4 + n]); o += 4 + n
    return out
def lp(b, o):
    n = u32(b, o); return b[o + 4:o + 4 + n], o + 4 + n

def signing_block(apk):
    e = apk.rfind(b"PK\x05\x06")
    cd = u32(apk, e + 16)
    if apk[cd - 16:cd] != b"APK Sig Block 42": raise SystemExit("no APK Signing Block")
    size = u64(apk, cd - 24); start = cd - size - 8
    pairs, o = {}, start + 8
    while o < cd - 24:
        n = u64(apk, o); pid = u32(apk, o + 8); pairs[pid] = apk[o + 12:o + 8 + n]; o += 8 + n
    return pairs

def sha(der): return hashlib.sha256(der).hexdigest()

def main(path):
    apk = open(path, "rb").read(); pairs = signing_block(apk); out = []
    if 0x7109871a in pairs:
        for signer in seq(lp(pairs[0x7109871a], 0)[0]):
            signed = lp(signer, 0)[0]; digests, o = lp(signed, 0); certs = lp(signed, o)[0]
            for c in seq(certs): out.append(("v2", "toutes versions de la v2", sha(c)))
    if 0xf05368c0 in pairs:
        for signer in seq(lp(pairs[0xf05368c0], 0)[0]):
            signed = lp(signer, 0)[0]; digests, o = lp(signed, 0); certs, o = lp(signed, o)
            mn, mx = u32(signed, o), u32(signed, o + 4); attrs = lp(signed, o + 8)[0]
            for c in seq(certs): out.append(("v3", "Android SDK %d à %s" % (mn, "max" if mx >= 0x7fffffff else mx), sha(c)))
            for a in seq(attrs):
                if u32(a, 0) == 0x3ba06f8c:   # proof of rotation: id, version, then the length-prefixed nodes
                    nodes = a[8:]
                    for i, node in enumerate(seq(nodes)):
                        sd = lp(node, 0)[0]; cert = lp(sd, 0)[0]; flags = u32(node, 4 + len(sd))
                        out.append(("lineage", "maillon %d, capacités 0x%x%s" % (i + 1, flags, " (sans rollback)" if not flags & 8 else ""), sha(cert)))
    for k, w, d in out: print("%-8s %-34s %s" % (k, w, d))

if __name__ == "__main__": main(sys.argv[1])
