#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
electron="$repo_root/node_modules/.bin/electron"
icon_source="$repo_root/icons/persona-icon.png"

if [[ ! -x "$electron" ]]; then
  echo "Electron is not installed. Run npm install in the Persona repository first." >&2
  exit 1
fi
if [[ ! -f "$icon_source" ]]; then
  echo "Persona icon not found: $icon_source" >&2
  exit 1
fi

data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
icon_dir="$data_home/icons/hicolor/256x256/apps"
app_dir="$data_home/applications"
runtime_dir="$data_home/persona"
launcher="$runtime_dir/persona-launcher"
desktop_file="$app_dir/persona.desktop"

install -Dm644 "$icon_source" "$icon_dir/persona.png"
mkdir -p "$app_dir" "$runtime_dir"

printf '#!/usr/bin/env bash\nexec %q %q --settings "$@"\n' \
  "$electron" "$repo_root" > "$launcher"
chmod 755 "$launcher"

cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=Persona
Comment=Open Persona and deploy a character
Exec="$launcher"
Icon=persona
Terminal=false
Categories=Utility;
StartupNotify=true
EOF
chmod 755 "$desktop_file"

desktop_dir=""
if command -v xdg-user-dir >/dev/null 2>&1; then
  desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
elif [[ -d "$HOME/Desktop" ]]; then
  desktop_dir="$HOME/Desktop"
fi

if [[ -n "$desktop_dir" && -d "$desktop_dir" ]]; then
  cp "$desktop_file" "$desktop_dir/Persona.desktop"
  chmod 755 "$desktop_dir/Persona.desktop"
fi

command -v update-desktop-database >/dev/null 2>&1 &&
  update-desktop-database "$app_dir" >/dev/null 2>&1 || true

echo "Persona launcher installed: $desktop_file"

if [[ "${1:-}" == "--open" ]]; then
  "$launcher" >/dev/null 2>&1 &
fi
