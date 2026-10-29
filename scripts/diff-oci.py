"""Lists files that differ between two OCI image tarballs (used when the reproducible build check fails)."""
import gzip, hashlib, io, json, sys, tarfile


def files(path):
    out = {}
    with tarfile.open(path) as oci:
        blob = lambda d: oci.extractfile("blobs/" + d.replace(":", "/")).read()
        index = json.loads(oci.extractfile("index.json").read())
        manifest = json.loads(blob(index["manifests"][0]["digest"]))
        out["<config>"] = json.loads(blob(manifest["config"]["digest"]))
        for n, layer in enumerate(manifest["layers"]):
            data = blob(layer["digest"])
            if data[:2] == b"\x1f\x8b":
                data = gzip.decompress(data)
            with tarfile.open(fileobj=io.BytesIO(data)) as t:
                for m in t.getmembers():
                    body = t.extractfile(m).read() if m.isfile() else b""
                    out[f"L{n}:{m.name}"] = (hashlib.sha256(body).hexdigest()[:12], m.mode, m.mtime, m.uid, m.gid, m.linkname, m.type)
    return out


a, b = files(sys.argv[1]), files(sys.argv[2])
if a["<config>"] != b["<config>"]:
    print("config differs:")
    print(json.dumps(a["<config>"], indent=1)[:2000])
    print(json.dumps(b["<config>"], indent=1)[:2000])
diff = sorted(k for k in a.keys() | b.keys() if k != "<config>" and a.get(k) != b.get(k))
print(f"{len(diff)} differing entries")
for k in diff[:80]:
    print(k, a.get(k), b.get(k))
