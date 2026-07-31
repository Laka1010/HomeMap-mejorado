import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Plus, Trash2 } from "lucide-react";
import { getPhotoError } from "../services/photoUtils.jsx";
import { useTranslation } from "../i18n";

/**
 * Galería deslizable de fotos, compartida por objetos/habitaciones/cajas.
 * Puramente de presentación: recibe `photos` (array de {id, url, isLegacy})
 * y las acciones ya resueltas por useEntityPhotos — no sabe nada de
 * Storage ni de la entidad concreta.
 *
 * El scroll-snap nativo cubre el swipe táctil; las flechas son solo para
 * ratón/teclado, donde no hay gesto de deslizar.
 */
export function PhotoGallery({ photos, loading, uploading, onAddPhotos, onDeletePhoto, height = 200 }) {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const inputRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState("");

  const scrollToIndex = (index) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(index, photos.length - 1));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setActiveIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    const invalid = files.map(getPhotoError).find(Boolean);
    if (invalid) {
      setError(t(invalid));
      return;
    }
    setError("");
    onAddPhotos(files);
  };

  return (
    <div>
      {photos.length > 0 && (
        <div style={{ position: "relative" }}>
          <div
            ref={trackRef}
            onScroll={handleScroll}
            style={{
              display: "flex",
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              borderRadius: 16,
              height,
              WebkitOverflowScrolling: "touch",
            }}
            className="hm-photo-gallery-track"
          >
            {photos.map((photo) => (
              <div key={photo.id} style={{ minWidth: "100%", scrollSnapAlign: "start", position: "relative", background: "var(--surface-alt)" }}>
                {photo.url ? (
                  <img src={photo.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "var(--ink-soft)" }}>
                    <ImageIcon size={28} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onDeletePhoto(photo)}
                  className="hm-btn--icon-circle hm-btn--danger"
                  aria-label={t("photoGallery.delete")}
                  title={t("photoGallery.delete")}
                  style={{ position: "absolute", top: 8, right: 8 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {photos.length > 1 && (
            <>
              {activeIndex > 0 && (
                <button type="button" onClick={() => scrollToIndex(activeIndex - 1)} className="hm-btn--icon-circle"
                  aria-label={t("photoGallery.previous")}
                  style={{ position: "absolute", top: "50%", left: 8, transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", color: "#fff", border: "none" }}>
                  <ChevronLeft size={16} />
                </button>
              )}
              {activeIndex < photos.length - 1 && (
                <button type="button" onClick={() => scrollToIndex(activeIndex + 1)} className="hm-btn--icon-circle"
                  aria-label={t("photoGallery.next")}
                  style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", color: "#fff", border: "none" }}>
                  <ChevronRight size={16} />
                </button>
              )}
              <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 8 }}>
                {photos.map((photo, i) => (
                  <span key={photo.id} style={{
                    width: 6, height: 6, borderRadius: 999,
                    background: i === activeIndex ? "var(--accent)" : "var(--border)",
                  }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {photos.length === 0 && !loading && (
        <div style={{ height, borderRadius: 16, background: "var(--surface-alt)", display: "grid", placeItems: "center", color: "var(--ink-soft)", textAlign: "center", gap: 4 }}>
          <ImageIcon size={26} />
          <div style={{ fontSize: 12, fontWeight: 600 }}>{t("photoGallery.empty")}</div>
        </div>
      )}

      <button
        type="button"
        className="hm-btn hm-btn-soft hm-btn--full"
        style={{ marginTop: 10 }}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <Plus size={15} /> {uploading ? t("photoGallery.uploading") : t("photoGallery.addPhotos")}
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
      {error && <p style={{ fontSize: 11.5, color: "var(--danger)", margin: "6px 0 0" }}>{error}</p>}

      <style>{`
        .hm-photo-gallery-track::-webkit-scrollbar { display: none; }
        .hm-photo-gallery-track { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
