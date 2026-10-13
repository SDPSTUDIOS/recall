#!/usr/bin/env bash
# Recall installer for macOS and Linux. Paste this into Terminal:
#
#   curl -fsSL https://github.com/SDPSTUDIOS/recall/releases/latest/download/install.sh | bash
#
# It installs Claude Code (if needed), signs you in, downloads Recall with its own
# copy of Node, adds a Recall shortcut to your Desktop and opens it. Nothing needs
# admin rights and nothing is installed system-wide. Run it again any time to repair
# or update Recall; your PDFs and results are kept.
#
# A specific (e.g. pre-release) version:  ... | bash -s -- --tag v0.3.0

# Everything is inside main(), so bash reads the whole script before running any of it
# (it arrives through a pipe) and nothing here can swallow the rest of the script as input.
main() {
  set -euo pipefail

  local repo="SDPSTUDIOS/recall"
  local home="${RECALL_HOME:-$HOME/.recall}"
  local tag="${RECALL_TAG:-}"
  while [ $# -gt 0 ]; do
    case "$1" in
      --tag) tag="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  local bold="" dim="" green="" red="" reset=""
  if [ -t 1 ]; then
    bold=$'\033[1m' dim=$'\033[2m' green=$'\033[32m' red=$'\033[31m' reset=$'\033[0m'
  fi
  step() { printf '\n%s%s%s\n' "$bold" "$1" "$reset"; }
  info() { printf '  %s\n' "$1"; }
  ok() { printf '  %s✓%s %s\n' "$green" "$reset" "$1"; }
  fail() {
    printf '\n%sSomething went wrong:%s %s\n' "$red" "$reset" "$1" >&2
    printf '%sIf this keeps happening, open an issue at https://github.com/%s/issues%s\n' "$dim" "$repo" "$reset" >&2
    exit 1
  }

  printf '%sInstalling Recall%s\n' "$bold" "$reset"
  printf '%sPractice exams from your lecture PDFs, using your Claude subscription.%s\n' "$dim" "$reset"

  # --- Which computer is this --------------------------------------------------
  local os arch
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) fail "This installer is for macOS and Linux. On Windows, use the PowerShell command in the README." ;;
  esac
  case "$(uname -m)" in
    arm64 | aarch64) arch=arm64 ;;
    x86_64 | amd64) arch=x64 ;;
    *) fail "Unsupported processor: $(uname -m)" ;;
  esac
  # A Terminal running under Rosetta reports x86_64 on Apple silicon.
  if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null)" = 1 ]; then
    arch=arm64
  fi

  local base
  if [ -n "${RECALL_BASE_URL:-}" ]; then
    base="$RECALL_BASE_URL" # testing against a local copy of a release
  elif [ -n "$tag" ]; then
    base="https://github.com/$repo/releases/download/$tag"
  else
    base="https://github.com/$repo/releases/latest/download"
  fi

  # --- 1. Find the release ----------------------------------------------------
  step "1/4  Finding the latest version of Recall"
  local manifest
  manifest="$(curl -fsSL "$base/manifest.json")" ||
    fail "Couldn't download Recall's release information. Check your internet connection and try again."
  local version node_version
  version="$(printf '%s\n' "$manifest" | sed -n 's/^  "version": "\(.*\)",$/\1/p')"
  # manifest.json has one field per line: find this platform's block, then its "node" line.
  node_version="$(printf '%s\n' "$manifest" |
    awk -v t="\"$os-$arch\"" 'index($0, t) { f = 1 } f && /"node"/ { gsub(/[",]/, ""); print $2; exit }')"
  [ -n "$node_version" ] || fail "Recall ${version:-} doesn't have a build for $os-$arch yet."
  ok "Recall $version"

  # --- 2. Node, privately -----------------------------------------------------
  step "2/4  Getting the tools Recall runs on"
  local node_dir="$home/node/$node_version"
  if [ -x "$node_dir/bin/node" ]; then
    ok "Node $node_version (already downloaded)"
  else
    local name="node-$node_version-$os-$arch"
    local tmp
    tmp="$(mktemp -d)"
    info "Downloading Node $node_version (about 50 MB)…"
    curl -fSL --progress-bar "https://nodejs.org/dist/$node_version/$name.tar.gz" -o "$tmp/node.tar.gz" ||
      fail "Couldn't download Node."
    local expected actual
    expected="$(curl -fsSL "https://nodejs.org/dist/$node_version/SHASUMS256.txt" | awk -v f="$name.tar.gz" '$2 == f { print $1 }')"
    if command -v shasum >/dev/null 2>&1; then
      actual="$(shasum -a 256 "$tmp/node.tar.gz" | awk '{ print $1 }')"
    else
      actual="$(sha256sum "$tmp/node.tar.gz" | awk '{ print $1 }')"
    fi
    [ -n "$expected" ] && [ "$expected" = "$actual" ] || fail "The Node download was corrupted. Please try again."
    tar -xzf "$tmp/node.tar.gz" -C "$tmp"
    mkdir -p "$home/node"
    rm -rf "$node_dir"
    mv "$tmp/$name" "$node_dir"
    rm -rf "$tmp"
    ok "Node $node_version"
  fi

  # --- 3. Claude Code ---------------------------------------------------------
  step "3/4  Connecting Claude"
  local claude=""
  if command -v claude >/dev/null 2>&1; then
    claude="$(command -v claude)"
  elif [ -x "$HOME/.local/bin/claude" ]; then
    claude="$HOME/.local/bin/claude"
  fi
  if [ -n "$claude" ]; then
    ok "Claude Code is installed"
  else
    info "Installing Claude Code (Anthropic's official installer)…"
    curl -fsSL https://claude.ai/install.sh | bash >/dev/null ||
      fail "Couldn't install Claude Code. See https://code.claude.com/docs/en/troubleshoot-install"
    claude="$HOME/.local/bin/claude"
    [ -x "$claude" ] || fail "Claude Code installed, but it isn't where it was expected ($claude)."
    ok "Claude Code installed"
  fi

  if "$claude" auth status 2>/dev/null | grep -q '"loggedIn": *true'; then
    ok "Signed in to Claude"
  elif (: </dev/tty) 2>/dev/null; then # an interactive terminal to sign in from
    info "Your browser will open so you can sign in to your Claude account."
    info "${dim}Recall needs a Claude Pro or Max plan. The free plan doesn't include Claude Code.${reset}"
    if "$claude" auth login </dev/tty; then
      ok "Signed in to Claude"
    else
      info "Sign-in didn't finish. You can do it later from Recall's Setup page."
    fi
  else
    info "Sign in later from Recall's Setup page."
  fi

  # --- 4. Recall ----------------------------------------------------------------
  step "4/4  Installing Recall"
  mkdir -p "$home"
  curl -fsSL "$base/launcher.mjs" -o "$home/launcher.mjs.download" || fail "Couldn't download Recall's launcher."
  mv "$home/launcher.mjs.download" "$home/launcher.mjs"
  "$node_dir/bin/node" "$home/launcher.mjs" install ${tag:+--tag "$tag"} </dev/null ||
    fail "Recall didn't install. Details are in $home/logs/launcher.log"

  printf '\n%s%sRecall is ready.%s\n' "$green" "$bold" "$reset"
  if [ "$os" = darwin ]; then
    info "Open it any time from the ${bold}Recall${reset} icon on your Desktop or in Applications."
  else
    info "Open it any time from the ${bold}Recall${reset} icon on your Desktop or in your apps menu."
  fi
  info "${dim}It's opening in your browser now. You can close this window.${reset}"
}

main "$@"
