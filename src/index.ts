// FavoriteImages — plugin robusto con fallbacks y dos modos de UI (mezcla + pestaña)

const log = (...a: any[]) => console.log("[FavoriteImages]", ...a);
const warn = (...a: any[]) => console.warn("[FavoriteImages]", ...a);

// ===== Almacenamiento con fallbacks =====
const KEY = "favorite_gifs";

function readStore(): any[] {
  try {
    const k = (globalThis as any).kettu?.storage;
    if (k) return Array.isArray(k.get(KEY)) ? k.get(KEY) : [];
  } catch {}
  try {
    const raw = (globalThis as any).localStorage?.getItem(KEY) || "[]";
    return JSON.parse(raw);
  } catch (e) {
    warn("Error leyendo storage:", e);
    return [];
  }
}

function writeStore(arr: any[]): void {
  try {
    const k = (globalThis as any).kettu?.storage;
    if (k) return k.set(KEY, arr);
  } catch {}
  try {
    (globalThis as any).localStorage?.setItem(KEY, JSON.stringify(arr));
  } catch (e) {
    warn("Error escribiendo storage:", e);
  }
}

function addImage(url: string): void {
  if (!url || typeof url !== "string") return;
  const u = url.toLowerCase().split("?")[0];
  if (!u.endsWith(".jpg") && !u.endsWith(".jpeg") && !u.endsWith(".png")) return;
  const list = readStore();
  if (list.some(x => x.url === url)) return;
  list.push({ url, type: "image", addedAt: Date.now() });
  writeStore(list);
}

// ===== Hooks =====
function installImageContextMenuHook(): void {
  const patch = (globalThis as any).kettu?.ui?.patchContextMenu || (globalThis as any).revenge?.patchContextMenu;
  if (!patch) return warn("No se encontró patchContextMenu");

  ["ImageContextMenu", "MediaContextMenu", "AttachmentContextMenu"].forEach(menuKey => {
    try {
      patch(menuKey, (items: any[], ctx: any) => {
        const url = ctx?.url || ctx?.src || ctx?.attachment?.url;
        const u = (url || "").toLowerCase().split("?")[0];
        const ok = u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png");
        if (!ok) return items;
        items.push({
          label: "Guardar en Favoritos (GIFs/Imágenes)",
          action: () => addImage(url)
        });
        return items;
      });
      log("Hook de menú instalado en:", menuKey);
    } catch (e) {
      warn("Fallo parcheando menú:", menuKey, e);
    }
  });
}

function installGifFavoritesMixHook(): void {
  const patchComponent = (globalThis as any).kettu?.ui?.patchComponent || (globalThis as any).revenge?.patchComponent;
  if (!patchComponent) return warn("No se encontró patchComponent");

  ["GifFavoritesPanel", "GifPickerFavorites", "FavoritesGrid"].forEach(displayName => {
    try {
      patchComponent(displayName, (Original: any) => {
        const Patched = (props: any) => {
          const vnode = Original(props);
          const imgs = readStore().filter(x => x.type === "image");
          const mapped = imgs.map(it => ({
            url: it.url,
            type: "gif",
            mediaType: "image",
            id: "favimg_" + it.addedAt
          }));
          if (Array.isArray(vnode?.props?.items)) vnode.props.items = [...mapped, ...vnode.props.items];
          else if (Array.isArray(vnode?.props?.data)) vnode.props.data = [...mapped, ...vnode.props.data];
          return vnode;
        };
        Patched.displayName = displayName;
        return Patched;
      });
      log("Mix hook instalado en:", displayName);
    } catch (e) {
      warn("Fallo parcheando componente:", displayName, e);
    }
  });
}

function installImagesTabFallback(): void {
  const patchComponent = (globalThis as any).kettu?.ui?.patchComponent || (globalThis as any).revenge?.patchComponent;
  if (!patchComponent) return;

  ["GifPickerView", "GifPickerModal"].forEach(displayName => {
    try {
      patchComponent(displayName, (Original: any) => {
        const Tabbed = (props: any) => {
          const vnode = Original(props);
          const imgs = readStore().filter(x => x.type === "image");
          const tabContent = {
            type: "View",
            props: {
              children: [
                { type: "Text", props: { children: "Imágenes favoritas" } },
                {
                  type: "View",
                  props: {
                    style: { display: "flex", flexWrap: "wrap", padding: 8 },
                    children: imgs.map(i => ({
                      type: "Image",
                      props: { source: { uri: i.url }, style: { width: 96, height: 96, margin: 4 } }
                    }))
                  }
                }
              ]
            }
          };
          if (Array.isArray(vnode?.props?.children)) vnode.props.children = [...vnode.props.children, tabContent];
          return vnode;
        };
        Tabbed.displayName = displayName;
        return Tabbed;
      });
      log("Fallback de pestaña instalado en:", displayName);
    } catch (e) {
      warn("Fallo pestaña:", displayName, e);
    }
  });
}

// ===== Exportación TS =====
export const name = "FavoriteImages";

export function onLoad(): void {
  log("Cargando plugin FavoriteImages…");
  installImageContextMenuHook();
  installGifFavoritesMixHook();
  installImagesTabFallback();
  log("FavoriteImages listo.");
}

export function onUnload(): void {
  log("Descargando plugin FavoriteImages…");
}
