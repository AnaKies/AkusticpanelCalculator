#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# НАСТРОЙКИ
# ============================================================

# Папка, откуда брать ZIP.
# В этой папке должен лежать ровно один .zip-файл.
SOURCE_DIR="/Users/anastasiakiessig/Downloads"

# Папка, куда копировать содержимое ZIP.
# Обычно это корень твоего проекта.
TARGET_DIR="/Users/anastasiakiessig/AI_proj/Akustikpanele"

# ============================================================
# ДАЛЬШЕ ОБЫЧНО НИЧЕГО МЕНЯТЬ НЕ НУЖНО
# ============================================================

echo "📁 SOURCE_DIR: $SOURCE_DIR"
echo "📁 TARGET_DIR: $TARGET_DIR"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Папка-источник не найдена: $SOURCE_DIR"
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "❌ Целевая папка не найдена: $TARGET_DIR"
  exit 1
fi

# Ищем ZIP-файлы в папке-источнике.
ZIP_FILES=()

while IFS= read -r -d '' file; do
  ZIP_FILES+=("$file")
done < <(find "$SOURCE_DIR" -maxdepth 1 -type f -iname "*.zip" -print0)

if [ "${#ZIP_FILES[@]}" -eq 0 ]; then
  echo "❌ В папке-источнике нет ZIP-файлов."
  exit 1
fi

if [ "${#ZIP_FILES[@]}" -gt 1 ]; then
  echo "❌ В папке-источнике найдено больше одного ZIP-файла:"
  for file in "${ZIP_FILES[@]}"; do
    echo " - $file"
  done
  echo ""
  echo "Оставь в SOURCE_DIR только один ZIP-файл и запусти скрипт снова."
  exit 1
fi

ZIP_FILE="${ZIP_FILES[0]}"

echo "📦 Найден ZIP: $ZIP_FILE"

TMP_DIR="$(mktemp -d)"
EXTRACT_DIR="$TMP_DIR/extracted"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$EXTRACT_DIR"

# Проверка ZIP на опасные пути:
# запрещаем абсолютные пути и ../
python3 - "$ZIP_FILE" <<'PY'
import sys
import zipfile
from pathlib import PurePosixPath

zip_path = sys.argv[1]
bad_paths = []

with zipfile.ZipFile(zip_path) as z:
    for info in z.infolist():
        name = info.filename
        path = PurePosixPath(name)

        if name.startswith("/") or ".." in path.parts:
            bad_paths.append(name)

if bad_paths:
    print("❌ В ZIP найдены опасные пути:")
    for path in bad_paths:
        print(" -", path)
    sys.exit(1)
PY

echo "📂 Распаковываю ZIP..."

# macOS-способ распаковки ZIP
ditto -x -k "$ZIP_FILE" "$EXTRACT_DIR"

echo "🔁 Копирую содержимое ZIP в целевую папку..."

# ВАЖНО:
# - rsync перезаписывает совпадающие файлы
# - создаёт новые файлы и папки
# - НЕ удаляет файлы проекта, которых нет в ZIP
rsync -av \
  --exclude="__MACOSX" \
  --exclude=".DS_Store" \
  "$EXTRACT_DIR"/ \
  "$TARGET_DIR"/

echo "🗑️ Перемещаю ZIP в корзину..."

TRASH_DIR="$HOME/.Trash"
mkdir -p "$TRASH_DIR"

ZIP_BASENAME="$(basename "$ZIP_FILE")"
TRASH_TARGET="$TRASH_DIR/$ZIP_BASENAME"

if [ -e "$TRASH_TARGET" ]; then
  TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
  TRASH_TARGET="$TRASH_DIR/${TIMESTAMP}-$ZIP_BASENAME"
fi

mv "$ZIP_FILE" "$TRASH_TARGET"

echo "✅ Готово."
echo "ZIP применён к проекту:"
echo "$TARGET_DIR"