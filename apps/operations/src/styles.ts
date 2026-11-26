import css from "./styles.css?inline";

export function installDeskStyles(): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById("lumen-desk-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "lumen-desk-styles";
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}
