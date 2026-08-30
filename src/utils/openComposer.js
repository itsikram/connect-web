/**
 * Open the Home create-post composer with an optional prefilled caption.
 * CreatePost only lives on `/`, so we navigate home first when needed.
 */
export function openCreatePost({
  caption = "",
  audience,
  navigate,
  file = null,
} = {}) {
  const fire = () => {
    window.dispatchEvent(
      new CustomEvent("openCreatePost", {
        detail: {
          caption: String(caption || "").slice(0, 500),
          audience,
          file,
        },
      }),
    );
  };

  const onHome =
    typeof window !== "undefined" &&
    (window.location.pathname === "/" || window.location.pathname === "");

  if (!onHome && typeof navigate === "function") {
    navigate("/");
    window.setTimeout(fire, 450);
    return;
  }

  fire();
}

export function shareCaption(caption, extras = {}) {
  openCreatePost({ caption, audience: 2, ...extras });
}
