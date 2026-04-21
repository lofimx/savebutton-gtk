# Copyright 2026 Gentoo Authors
# Distributed under the terms of the GNU General Public License v2

EAPI=8

inherit meson xdg

DESCRIPTION="Simple bookmark manager"
HOMEPAGE="https://github.com/lofimx/savebutton-gtk"
SRC_URI="
	https://github.com/lofimx/savebutton-gtk/archive/refs/tags/v${PV}.tar.gz -> ${P}.tar.gz
	https://github.com/lofimx/savebutton-gtk/releases/download/v${PV}/${P}-deps.tar.xz
"
S="${WORKDIR}/savebutton-gtk-${PV}"

# AGPL-3 for the application; MIT for bundled marked and temporal-polyfill
LICENSE="AGPL-3 MIT"
SLOT="0"
KEYWORDS="~amd64"

RDEPEND="
	>=dev-libs/gjs-1.54
	gui-libs/gtk:4
	gui-libs/libadwaita:1
	app-crypt/libsecret
"
DEPEND="${RDEPEND}"
BDEPEND="
	net-libs/nodejs
	virtual/pkgconfig
	sys-devel/gettext
	dev-util/desktop-file-utils
"

src_prepare() {
	default

	# The deps tarball extracts node_modules and pre-bundled vendor files
	# into the source tree. Verify they are present.
	[[ -d node_modules ]] || die "node_modules missing — deps tarball not extracted?"
	[[ -f src/vendor/temporal.js ]] || die "vendor/temporal.js missing — deps tarball incomplete?"
	[[ -f src/vendor/marked.js ]] || die "vendor/marked.js missing — deps tarball incomplete?"

	# Create a tsc wrapper in ${T}/bin so meson's find_program('tsc') works.
	# node_modules/.bin/tsc is a symlink that may not survive tarball extraction,
	# and the sandbox may restrict execution from ${S}.
	mkdir -p "${T}/bin" || die
	cat > "${T}/bin/tsc" <<-WRAPPER
	#!/usr/bin/env bash
	exec node "${S}/node_modules/typescript/bin/tsc" "\$@"
	WRAPPER
	chmod +x "${T}/bin/tsc" || die
}

src_configure() {
	export PATH="${T}/bin:${PATH}"
	meson_src_configure
}
