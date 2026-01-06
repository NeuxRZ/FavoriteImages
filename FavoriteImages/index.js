// FavoriteImages/index.js
// Plugin robusto con fallbacks y dos modos de UI (mezcla + pestaña)

(function () {
  const log = (...a) => console.log("[FavoriteImages]", ...a);
  const warn = (...a) => console.warn("[FavoriteImages]", ...a);

  // ===== Almacenamiento con fallbacks =====
  const Storage = (() => {
    const kettu = (globalThis.kettu && globalThis.kettu.storage) || null;
    const dn = (globalThis.DiscordNative && globalThis.DiscordNative.storage) || null;
    const ls = (globalThis.localStorage && {
      getItem: (k) => globalThis.localStorage.getItem(k),
      setItem: (k, v) => globalThis.localStorage.setItem(k, v),
    }) || null;

    const KEY = "favorite_gifs";

    function read() {
      try {
        if (kettu) return Array.isArray(kettu.get(KEY)) ? kettu.get(KEY) : [];
        if (dn) return JSON.parse(dn.getItem(KEY) || "[]");
        if (ls) return JSON.parse(ls.getItem(KEY) || "[]");
      } catch (e) {
        warn("Error leyendo storage:", e);
      }
      return [];
    }

    function write(arr) {
      try {
        const str = JSON.stringify(arr);
        if (kettu) return kettu.set(KEY, arr);
        if (dn) return dn.setItem(KEY, str);
        if (ls) return ls.setItem(KEY, str);
      } catch (e) {
        warn("Error escribiendo storage:", e);
      }
    }

    function addImage(url) {
      const list = read();
      if (list.some((x) => x.url === url)) return;
      list.push({ url, type: "image", addedAt: Date.now() });
      write(list);
    }

    function getImages() {
      return read().filter((x) => x.type === "image");
    }

    return { addImage, getImages };
  })();

  // ===== Validación de imágenes =====
  function isSupportedImage(url) {
    if (!url || typeof url !== "string") return false;
    const u = url.toLowerCase().split("?")[0];
    return u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png");
  }

  // ===== Hook de menú contextual =====
  function installImageContextMenuHook() {
    const patch =
      (globalThis.kettu?.ui?.patchContextMenu) ||
      (globalThis.revenge?.patchContextMenu);
    if (!patch) return warn("No se encontró patchContextMenu");

    ["ImageContextMenu", "MediaContextMenu", "AttachmentContextMenu"].forEach((menuKey) => {
      try {
        patch(menuKey, (items, ctx) => {
          const url = ctx?.url || ctx?.src || ctx?.attachment?.url;
          if (!isSupportedImage(url)) return items;
          items.push({
            label: "Guardar en Favoritos (GIFs/Imágenes)",
            action: () => Storage.addImage(url),
          });
          return items;
        });
        log("Hook instalado en:", menuKey);
      } catch {}
    });
  }

  // ===== Mezcla en GIFs favoritos =====
  function installGifFavoritesMixHook() {
    const patchComponent =
      globalThis.kettu?.ui?.patchComponent ||
      globalThis.revenge?.patchComponent;
    if (!patchComponent) return warn("No se encontró patchComponent");

    ["GifFavoritesPanel", "GifPickerFavorites", "FavoritesGrid"].forEach((displayName) => {
      try {
        patchComponent(displayName, (Original) => {
          const Patched = (props) => {
            const vnode = Original(props);
            const imgs = Storage.getImages();
            const inject = (arr) => {
              if (!Array.isArray(arr)) return arr;
              const mapped = imgs.map((it) => ({
                url: it.url,
                type: "gif",
                mediaType: "image",
                id: "favimg_" + it.addedAt,
              }));
              return [...mapped, ...arr];
            };
            if (Array.isArray(vnode?.props?.items)) vnode.props.items = inject(vnode.props.items);
            else if (Array.isArray(vnode?.props?.data)) vnode.props.data = inject(vnode.props.data);
            return vnode;
          };
          Patched.displayName = displayName;
          return Patched;
        });
        log("Mix hook instalado en:", displayName);
      } catch {}
    });
  }

  // ===== Pestaña fallback =====
  function installImagesTabFallback() {
    const patchComponent =
      globalThis.kettu?.ui?.patchComponent ||
      globalThis.revenge?.patchComponent;
    if (!patchComponent) return;

    ["GifPickerView", "GifPickerModal"].forEach((displayName) => {
      try {
        patchComponent(displayName, (Original) => {
          const Tabbed = (props) => {
            const vnode = Original(props);
            const imgs = Storage.getImages();
            const tabContent = {
              type: "View",
              props: {
                children: [
                  { type: "Text", props: { children: "Imágenes favoritas" } },
                  {
                    type: "View",
                    props: {
                      style: { display: "flex", flexWrap: "wrap", padding: 8 },
                      children: imgs.map((i) => ({
                        type: "Image",
                        props: { source: { uri: i.url }, style: { width: 96, height: 96, margin: 4 } },
                      })),
                    },
                  },
                ],
              },
            };
            if (Array.isArray(vnode?.props?.children)) {
              vnode.props.children = [...vnode.props.children, tabContent];
            }
            return vnode;
          };
          Tabbed.displayName = displayName;
          return Tabbed;
        });
        log("Fallback de pestaña instalado en:", displayName);
      } catch {}
    });
  }

  // ===== Registro =====
  function onLoad() {
    log("Cargando plugin FavoriteImages…");
    installImageContextMenuHook();
    installGifFavoritesMixHook();
    installImagesTabFallback();
    log("FavoriteImages listo.");
  }

  function onUnload() {
    log("Descargando plugin FavoriteImages…");
  }

  if (globalThis.kettu?.registerPlugin) {
    globalThis.kettu.registerPlugin({ onLoad, onUnload, name: "FavoriteImages" });
  } else {
    onLoad();
  }
})();
