#!/bin/sh

set -eu

UUID_V7_PATTERN='^[0-9a-fA-F]\{8\}-[0-9a-fA-F]\{4\}-7[0-9a-fA-F]\{3\}-[89aAbB][0-9a-fA-F]\{3\}-[0-9a-fA-F]\{12\}$'

print_help() {
  cat <<'EOF'
Usage: npm run rename:images [-- --dry-run]

Renames image files under static/images to UUID v7 names and updates matching
/images/... references in content/**/*.md. The static/images/thumbnails directory
and files that already have UUID v7 names are skipped.

Options:
  --dry-run      Show planned changes without modifying files
  --root <path>  Use another project root
  -h, --help     Show this help
EOF
}

is_image_extension() {
  case "$1" in
    .avif|.bmp|.gif|.jpeg|.jpg|.png|.svg|.tif|.tiff|.webp)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_uuid_v7() {
  LC_ALL=C grep "$UUID_V7_PATTERN" >/dev/null 2>&1 <<EOF
$1
EOF
}

generate_uuid_v7() {
  timestamp_ms=$(($(date +%s) * 1000))
  timestamp_hex=$(printf '%012x' "$timestamp_ms")
  random_hex=$(dd if=/dev/urandom bs=10 count=1 2>/dev/null | od -An -v -tx1 | tr -d ' \n')

  if [ "${#random_hex}" -ne 20 ]; then
    printf '%s\n' 'Failed to generate random bytes for UUID v7.' >&2
    return 1
  fi

  timestamp_high=$(printf '%s' "$timestamp_hex" | cut -c 1-8)
  timestamp_low=$(printf '%s' "$timestamp_hex" | cut -c 9-12)
  random_a=$(printf '%s' "$random_hex" | cut -c 1-3)
  variant_source=$(printf '%s' "$random_hex" | cut -c 4)
  variant=$(printf '%x' "$(((0x$variant_source & 3) | 8))")
  random_b_high=$(printf '%s' "$random_hex" | cut -c 5-7)
  random_b_low=$(printf '%s' "$random_hex" | cut -c 8-19)

  printf '%s-%s-7%s-%s%s-%s\n' \
    "$timestamp_high" \
    "$timestamp_low" \
    "$random_a" \
    "$variant" \
    "$random_b_high" \
    "$random_b_low"
}

percent_encode_path() {
  printf '%s' "$1" | LC_ALL=C od -An -v -tx1 | tr ' ' '\n' | while IFS= read -r byte
  do
    [ -n "$byte" ] || continue

    case "$byte" in
      2f)
        printf '/'
        ;;
      2d|2e|5f|7e|3[0-9]|4[1-9a-f]|5[0-9a]|6[1-9a-f]|7[0-9a])
        octal=$(printf '%03o' "$((0x$byte))")
        printf "\\$octal"
        ;;
      *)
        printf '%%%s' "$(printf '%s' "$byte" | tr '[:lower:]' '[:upper:]')"
        ;;
    esac
  done
}

update_reference() {
  old_reference=$1
  new_reference=$2
  markdown_file=$3
  temporary_file="${markdown_file}.rename-images.$$"

  trap 'rm -f "$temporary_file"' 0 HUP INT TERM
  OLD_IMAGE_REFERENCE=$old_reference
  NEW_IMAGE_REFERENCE=$new_reference
  export OLD_IMAGE_REFERENCE NEW_IMAGE_REFERENCE

  awk '
    BEGIN {
      old_reference = ENVIRON["OLD_IMAGE_REFERENCE"]
      new_reference = ENVIRON["NEW_IMAGE_REFERENCE"]
    }
    {
      remaining = $0
      output = ""
      while ((position = index(remaining, old_reference)) > 0) {
        output = output substr(remaining, 1, position - 1) new_reference
        remaining = substr(remaining, position + length(old_reference))
      }
      print output remaining
    }
  ' "$markdown_file" >"$temporary_file"

  if cmp -s "$markdown_file" "$temporary_file"; then
    rm -f "$temporary_file"
    return 0
  fi

  cat "$temporary_file" >"$markdown_file"
  rm -f "$temporary_file"
  printf '  Updated %s\n' "$markdown_file"
}

process_image() {
  project_root=$1
  dry_run=$2
  source_path=$3
  images_directory=$project_root/static/images
  content_directory=$project_root/content

  filename=${source_path##*/}
  case "$filename" in
    *.*)
      ;;
    *)
      return 0
      ;;
  esac

  extension=.${filename##*.}
  lowercase_extension=$(printf '%s' "$extension" | tr '[:upper:]' '[:lower:]')
  is_image_extension "$lowercase_extension" || return 0

  basename=${filename%.*}
  is_uuid_v7 "$basename" && return 0

  destination_directory=${source_path%/*}
  while :; do
    uuid=$(generate_uuid_v7)
    destination_path=$destination_directory/$uuid$extension
    if [ ! -f "$destination_path" ] && [ ! -d "$destination_path" ]; then
      break
    fi
  done

  image_prefix=$images_directory/
  source_relative=${source_path#"$image_prefix"}
  destination_relative=${destination_path#"$image_prefix"}
  old_url=/images/$source_relative
  new_url=/images/$destination_relative

  if [ "$dry_run" = '1' ]; then
    printf 'Would rename %s -> %s\n' "$source_path" "$destination_path"
    return 0
  fi

  printf 'Renaming %s -> %s\n' "$source_path" "$destination_path"
  mv "$source_path" "$destination_path"

  find "$content_directory" -type f -name '*.md' \
    -exec sh "$SCRIPT_PATH" --update-reference "$old_url" "$new_url" {} \;

  encoded_old_url=$(percent_encode_path "$old_url")
  if [ "$encoded_old_url" != "$old_url" ]; then
    encoded_new_url=$(percent_encode_path "$new_url")
    find "$content_directory" -type f -name '*.md' \
      -exec sh "$SCRIPT_PATH" --update-reference "$encoded_old_url" "$encoded_new_url" {} \;
  fi
}

SCRIPT_DIRECTORY=$(CDPATH= cd "$(dirname "$0")" && pwd)
SCRIPT_PATH=$SCRIPT_DIRECTORY/$(basename "$0")

case ${1-} in
  --process-image)
    if [ "$#" -ne 4 ]; then
      printf '%s\n' 'Invalid internal --process-image invocation.' >&2
      exit 1
    fi
    process_image "$2" "$3" "$4"
    exit 0
    ;;
  --update-reference)
    if [ "$#" -ne 4 ]; then
      printf '%s\n' 'Invalid internal --update-reference invocation.' >&2
      exit 1
    fi
    update_reference "$2" "$3" "$4"
    exit 0
    ;;
esac

DRY_RUN=0
ROOT_ARGUMENT=

while [ "$#" -gt 0 ]; do
  case $1 in
    --dry-run)
      DRY_RUN=1
      ;;
    --root)
      shift
      if [ "$#" -eq 0 ]; then
        printf '%s\n' '--root requires a directory path.' >&2
        exit 1
      fi
      ROOT_ARGUMENT=$1
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
  shift
done

if [ -n "$ROOT_ARGUMENT" ]; then
  ROOT_DIRECTORY=$(CDPATH= cd "$ROOT_ARGUMENT" && pwd)
else
  ROOT_DIRECTORY=$(CDPATH= cd "$SCRIPT_DIRECTORY/.." && pwd)
fi

IMAGES_DIRECTORY=$ROOT_DIRECTORY/static/images
CONTENT_DIRECTORY=$ROOT_DIRECTORY/content

if [ ! -d "$IMAGES_DIRECTORY" ]; then
  printf 'Image directory not found: %s\n' "$IMAGES_DIRECTORY" >&2
  exit 1
fi

if [ ! -d "$CONTENT_DIRECTORY" ]; then
  printf 'Content directory not found: %s\n' "$CONTENT_DIRECTORY" >&2
  exit 1
fi

find "$IMAGES_DIRECTORY" \
  \( -type d -path "$IMAGES_DIRECTORY/thumbnails" -prune \) -o \
  \( -type f -exec sh "$SCRIPT_PATH" --process-image "$ROOT_DIRECTORY" "$DRY_RUN" {} \; \)

if [ "$DRY_RUN" = '1' ]; then
  printf '%s\n' 'Dry run completed. No files were changed.'
else
  printf '%s\n' 'Image rename completed.'
fi
