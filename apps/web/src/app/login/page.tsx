"use client";

import { useState } from "react";
import { authCall } from "@/lib/client/api";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authCall("request-code", { email });
      setStep("code");
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authCall("verify", { email, code });
      window.location.href = "/panel";
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy via-[#063a7a] to-brand p-4">
      <div className="w-full max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/panel/logo.png" alt="UPS GO" className="mx-auto mb-6 h-24 w-auto" />
        <div className="rounded-3xl bg-white p-7 shadow-2xl">
          <h1 className="text-xl font-extrabold text-navy">Panel administrativo</h1>
          <p className="mt-1 text-sm text-muted">
            {step === "email"
              ? "Ingresa con tu correo de administrador. Te enviaremos un código de acceso."
              : `Escribe el código de 6 dígitos que enviamos a ${email}.`}
          </p>
          {step === "email" ? (
            <form onSubmit={requestCode} className="mt-6 space-y-4">
              <Field label="Correo">
                <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@ups.edu.ec" />
              </Field>
              <ErrorNote error={error} />
              <Button type="submit" tone="gold" loading={loading} className="w-full">Enviar código</Button>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-6 space-y-4">
              <Field label="Código de verificación">
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl tracking-[0.5em]"
                />
              </Field>
              <ErrorNote error={error} />
              <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full">Verificar e ingresar</Button>
              <button type="button" onClick={() => { setStep("email"); setCode(""); setError(null); }} className="w-full text-sm font-semibold text-brand">
                Usar otro correo
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-[#c9dbf0]">Universidad Politécnica Salesiana · Transporte universitario</p>
      </div>
    </div>
  );
}
