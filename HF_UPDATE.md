How to update the Hugging Face Space (Nand-11/ML_gui) to fix the build

Summary
- The Space currently fails during build due to a Gradio version mismatch between the Space SDK frontmatter and `requirements.txt`.
- This repository includes `requirements.txt` that matches `gradio==5.49.1` (the version set in the Space README frontmatter). Apply the same file to the Space repo.

Steps you can run locally (recommended)

1. Clone the Space repo (replace with your HF username or use the Space git URL):

```bash
git clone https://huggingface.co/spaces/Nand-11/ML_gui
cd ML_gui
```

2. Replace or update `requirements.txt` with the file in this repo (copy contents of `requirements.txt`). Ensure `gradio==5.49.1` is present or remove `gradio` and rely on the Space SDK.

3. Commit and push:

```bash
git add requirements.txt
git commit -m "Fix: pin gradio to 5.49.1 to match SDK and avoid build conflicts"
git push
```

4. Trigger a rebuild from the Space UI (Build → Rebuild) or wait — pushing should auto-retrigger.

If the build still fails
- Open the Space build logs (Builds → open logs) and copy the full pip error lines here. I can analyze them and propose a fix (e.g., add system deps or change package versions).
- If a package needs system libraries (rare), create a `Dockerfile` for the Space that installs apt packages before pip.

If you want, I can prepare a PR-like commit directly to the Space repo — provide push access or add the Space repo to this workspace.
