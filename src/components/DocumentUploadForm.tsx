"use client";

import { useActionState } from "react";
import { uploadDocumentAction, type UploadState } from "@/app/business/documents/actions";
import { documentInfo, MAX_UPLOAD_BYTES, uploadableTypes } from "@/domain/documents";
import { SelectField } from "./FormField";

const options = uploadableTypes.map((type) => ({ value: type, label: documentInfo[type].label }));
const maxMb = MAX_UPLOAD_BYTES / (1024 * 1024);

export function DocumentUploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadDocumentAction, {
    status: "idle",
  });

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      )}
      <SelectField
        id="type"
        label="Which document is it?"
        placeholder="Choose one"
        options={options}
      />
      <div>
        <label htmlFor="file" className="block text-sm font-medium text-gray-800">
          File
        </label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          aria-describedby="file-hint"
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-dark"
        />
        <p id="file-hint" className="mt-1 text-xs text-gray-500">
          PDF, JPG or PNG, up to {maxMb} MB. It is stored privately: only you and our verification
          team can open it.
        </p>
      </div>
      <button type="submit" disabled={pending} className="btn-primary px-5">
        {pending ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
