Name:           savebutton
Version:        VERSION_PLACEHOLDER
Release:        1%{?dist}
Summary:        Simple bookmark manager
License:        AGPL-3.0-only
URL:            https://github.com/lofimx/savebutton-gtk
Source0:        %{name}-%{version}.tar.gz

%global debug_package %{nil}

BuildRequires:  meson >= 0.62.0
BuildRequires:  ninja-build
BuildRequires:  nodejs
BuildRequires:  npm
BuildRequires:  gjs-devel >= 1.54
BuildRequires:  gtk4-devel
BuildRequires:  libadwaita-devel
BuildRequires:  libsecret-devel
BuildRequires:  gettext
BuildRequires:  desktop-file-utils
BuildRequires:  libappstream-glib
BuildRequires:  glib2-devel

Requires:       gjs >= 1.54
Requires:       gtk4
Requires:       libadwaita
Requires:       libsecret

%description
Save Button is a local-first bookmarking application
for GNOME desktop environments.

%prep
%autosetup -n savebutton-gtk-%{version}

%build
npm install --include=dev
export PATH="$PWD/node_modules/.bin:$PATH"
%meson
%meson_build

%install
%meson_install

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/org.savebutton.SaveButton.desktop

%post
glib-compile-schemas %{_datadir}/glib-2.0/schemas &>/dev/null || :
gtk-update-icon-cache %{_datadir}/icons/hicolor &>/dev/null || :
update-desktop-database &>/dev/null || :

%postun
glib-compile-schemas %{_datadir}/glib-2.0/schemas &>/dev/null || :
gtk-update-icon-cache %{_datadir}/icons/hicolor &>/dev/null || :
update-desktop-database &>/dev/null || :

%files
%license LICENSE
%{_bindir}/org.savebutton.SaveButton
%{_datadir}/savebutton/
%{_datadir}/applications/org.savebutton.SaveButton.desktop
%{_datadir}/metainfo/org.savebutton.SaveButton.metainfo.xml
%{_datadir}/glib-2.0/schemas/org.savebutton.SaveButton.gschema.xml
%{_datadir}/icons/hicolor/*/apps/org.savebutton.SaveButton*
