import { useEffect, useRef, useState } from "react";
import { apiGet, apiSend, apiUpload } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Profile } from "@/types";

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // AI-generated preview
  const [selected, setSelected] = useState<string | null>(null); // chosen profile picture URL
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sign-in method decides which identity fields are locked (item 5).
  const provider = (user?.app_metadata?.provider as string | undefined) ?? "email";
  const emailLocked = provider === "google" || provider === "azure";
  const phoneLocked = provider === "phone";
  const email = user?.email ?? "";

  useEffect(() => {
    apiGet("/api/profile")
      .then((p: Profile) => {
        setProfile(p);
        setFirstName(p.first_name ?? "");
        setLastName(p.last_name ?? "");
        setPhone(p.phone ?? user?.phone ?? "");
        setPhotoUrl(p.photo_url ?? null);
        setSelected(p.avatar_url ?? null);
      })
      .catch((e) => setStatus({ kind: "err", msg: e?.message ?? "Couldn't load your profile." }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setAvatarUrl(null);
    setUploading(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const { photo_url } = await apiUpload("/api/profile/photo", fd);
      setPhotoUrl(photo_url);
      setSelected((prev) => prev ?? photo_url); // default the picture to the photo if none chosen yet
    } catch (err: any) {
      setStatus({ kind: "err", msg: err?.message ?? "Couldn't upload that photo." });
    } finally {
      setUploading(false);
    }
  }

  async function generateAvatar() {
    if (!photoFile) {
      setStatus({ kind: "err", msg: "Upload a photo first, then I can create an avatar from it." });
      return;
    }
    setGenerating(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      const { avatar_url } = await apiUpload("/api/profile/avatar", fd);
      setAvatarUrl(avatar_url);
    } catch (err: any) {
      // Graceful degradation — keep the uploaded photo usable.
      setStatus({ kind: "err", msg: err?.message ?? "Avatar generation is unavailable right now." });
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const updated = await apiSend("PATCH", "/api/profile", {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        display_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || null,
        phone: phoneLocked ? undefined : phone.trim() || null,
        avatar_url: selected,
      });
      setProfile(updated);
      setStatus({ kind: "ok", msg: "Profile saved." });
    } catch (err: any) {
      setStatus({ kind: "err", msg: err?.message ?? "Couldn't save your profile." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-forest-light dark:text-night-muted">Loading your profile…</div>;

  const initials =
    (firstName[0] ?? email[0] ?? "?").toUpperCase() + (lastName[0] ? lastName[0].toUpperCase() : "");

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">Your profile</h1>
        <p className="text-forest-light dark:text-night-muted">Tell Penny who you are — and pick a picture or an AI avatar.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Picture / avatar */}
        <div className="rounded-xl2 bg-white p-6 shadow-card dark:bg-night-card">
          <h2 className="mb-4 font-display text-lg font-bold text-forest-dark dark:text-night-ink">Profile picture</h2>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-forest-50 text-3xl font-extrabold text-forest dark:bg-white/5 dark:text-night-ink">
              {selected ? (
                <img src={selected} alt="Selected profile" className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream shadow-card transition hover:bg-forest-dark disabled:opacity-60"
            >
              {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
            </button>

            <button
              onClick={generateAvatar}
              disabled={!photoFile || generating}
              className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-forest-dark shadow-card transition hover:bg-gold-light disabled:opacity-50"
              title={!photoFile ? "Upload a photo first" : "Create an AI avatar from your photo"}
            >
              {generating ? "Creating avatar…" : "✨ Create AI avatar"}
            </button>

            {/* Options: uploaded photo vs. generated avatar */}
            {(photoUrl || avatarUrl) && (
              <div className="flex w-full flex-wrap justify-center gap-3">
                {photoUrl && (
                  <PictureOption
                    label="Your photo"
                    url={photoUrl}
                    active={selected === photoUrl}
                    onSelect={() => setSelected(photoUrl)}
                  />
                )}
                {avatarUrl && (
                  <PictureOption
                    label="AI avatar"
                    url={avatarUrl}
                    active={selected === avatarUrl}
                    onSelect={() => setSelected(avatarUrl)}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="rounded-xl2 bg-white p-6 shadow-card dark:bg-night-card lg:col-span-2">
          <h2 className="mb-4 font-display text-lg font-bold text-forest-dark dark:text-night-ink">Details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ada"
                className="ww-input"
              />
            </Field>
            <Field label="Last name">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Lovelace"
                className="ww-input"
              />
            </Field>
            <Field label="Email" hint={emailLocked ? "From your Google/Microsoft sign-in" : undefined}>
              <input
                value={email}
                readOnly={emailLocked}
                disabled
                className="ww-input opacity-70"
              />
            </Field>
            <Field label="Mobile number" hint={phoneLocked ? "From your phone sign-in" : undefined}>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                readOnly={phoneLocked}
                disabled={phoneLocked}
                placeholder="+1 555 123 4567"
                className={`ww-input ${phoneLocked ? "opacity-70" : ""}`}
              />
            </Field>
          </div>

          {status && (
            <p className={`mt-4 text-sm ${status.kind === "ok" ? "text-forest" : "text-coral-dark"}`}>{status.msg}</p>
          )}

          <div className="mt-6">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-forest px-6 py-2.5 font-semibold text-cream shadow-card transition hover:bg-forest-dark disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PictureOption({ label, url, active, onSelect }: { label: string; url: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex flex-col items-center gap-1 rounded-xl2 border-2 p-2 transition ${
        active ? "border-gold bg-gold/10" : "border-transparent hover:bg-forest-50 dark:hover:bg-white/5"
      }`}
    >
      <img src={url} alt={label} className="h-16 w-16 rounded-full object-cover" />
      <span className="text-xs font-semibold text-forest-dark dark:text-night-ink">{label}</span>
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-forest-light dark:text-night-muted">🔒 {hint}</span>}
    </label>
  );
}
