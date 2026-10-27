import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "@/domain/documents";
import { readProofForm, readUploadForm } from "./form-input";

function form(type: string, file?: File) {
  const data = new FormData();
  data.set("type", type);
  if (file) data.set("file", file);
  return data;
}

describe("readUploadForm", () => {
  it("returns the document type and the file's bytes", async () => {
    const result = await readUploadForm(
      form("id", new File([new Uint8Array([1, 2, 3])], "id.pdf")),
    );
    expect(result.type).toBe("id");
    expect(Array.from(result.bytes ?? [])).toEqual([1, 2, 3]);
  });

  it("treats the empty, nameless file a browser sends for 'no file chosen' as no file", async () => {
    expect((await readUploadForm(form("id", new File([], "")))).bytes).toBeNull();
    expect((await readUploadForm(form("id"))).bytes).toBeNull();
  });

  it("passes a genuinely empty named file through so it can be reported as empty", async () => {
    const result = await readUploadForm(form("id", new File([], "blank.pdf")));
    expect(result.bytes).toEqual(new Uint8Array());
  });

  it("never reads more than one byte beyond the size limit", async () => {
    const big = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1000)], "big.pdf");
    const result = await readUploadForm(form("id", big));
    expect(result.bytes?.length).toBe(MAX_UPLOAD_BYTES + 1);
  });

  it("copes with a missing type", async () => {
    expect((await readUploadForm(new FormData())).type).toBe("");
  });
});

describe("readProofForm", () => {
  it("reads the milestone, the goal and the file", async () => {
    const data = new FormData();
    data.set("milestoneId", "m1");
    data.set("goalId", "g1");
    data.set("file", new File([new Uint8Array([9, 8])], "invoice.pdf"));
    const result = await readProofForm(data);
    expect(result.milestoneId).toBe("m1");
    expect(result.goalId).toBe("g1");
    expect(Array.from(result.bytes ?? [])).toEqual([9, 8]);
  });
  it("treats a missing file as no file", async () => {
    const data = new FormData();
    data.set("milestoneId", "m1");
    expect((await readProofForm(data)).bytes).toBeNull();
  });
});
