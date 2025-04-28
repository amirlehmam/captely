"use client";
import { useState } from "react";
import importApi from "../utils/importApi";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ status: string; completed: number; total: number } | null>(null);

  const submit = async () => {
    if (!file) return alert("Please select a file");
    const form = new FormData();
    form.append("file", file);
    const res = await importApi.post<{ job_id: string }>("/imports", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setJobId(res.data.job_id);
    poll(res.data.job_id);
  };

  function poll(id: string) {
    const iv = setInterval(async () => {
      const r = await importApi.get<{ status: string; completed: number; total: number }>(`/imports/${id}`);
      setStatus(r.data);
      if (r.data.status === "done" || r.data.status === "failed") {
        clearInterval(iv);
      }
    }, 1000);
  }

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>Import Contacts</h1>
      <input type="file" accept=".csv,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button onClick={submit} disabled={!file} style={{ marginLeft: 8 }}>Upload & Start</button>

      {jobId && status && (
        <div style={{ marginTop: 20 }}>
          <p>Job #{jobId}: {status.status}</p>
          <p>Progress: {status.completed}/{status.total}</p>
          {status.status === "done" && (
            <a href={`http://localhost:8002/imports/${jobId}/results`} target="_blank">Download Results</a>
          )}
        </div>
      )}
    </div>
  );
}
