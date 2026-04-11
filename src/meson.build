gnome = import('gnome')

sources = files(
  'models/anga.ts',
  'models/clock.ts',
  'models/dropped.ts',
  'models/filename.ts',
  'models/native_host/native_host_request.ts',
  'models/markdown_renderer.ts',
  'models/meta.ts',
  'models/search_result.ts',
  'models/tags_list.ts',
  'models/tile_widget.ts',
  'models/timestamp.ts',
  'services/auth_service.ts',
  'services/file_service.ts',
  'services/logger.ts',
  'services/meta_service.ts',
  'services/search_service.ts',
  'services/settings_service.ts',
  'services/share_service.ts',
  'services/native_host/native_host_server.ts',
  'services/sync/local_repo.ts',
  'services/sync/sync_anga.ts',
  'services/sync/sync_file.ts',
  'services/sync/sync_meta.ts',
  'services/sync/sync_result.ts',
  'services/sync/server_repo.ts',
  'services/sync/sync_words.ts',
  'services/sync_manager.ts',
  'services/sync_service.ts',
  'views/everything_window.ts',
  'views/new_save_window.ts',
  'views/preferences.ts',
  'views/preview_window.ts',
  'views/tags_entry.ts',
  'main.ts',
)

tsc_out = meson.project_build_root() / 'tsc-out'

# Bundle npm dependencies (Temporal polyfill)
bundle_vendor = custom_target(
  'bundle-vendor',
  output: 'vendor-bundled',
  build_by_default: true,
  build_always_stale: true,
  command: [
    'sh',
    '-c', 'cd @0@ && npm install && npm run bundle:temporal && npm run bundle:marked && touch @1@'.format(
      meson.project_source_root(),
      meson.current_build_dir() / 'vendor-bundled',
    ),
  ],
)

# Copy vendor files to output directory
copy_vendor = custom_target(
  'copy-vendor',
  input: files('vendor/marked.js', 'vendor/temporal.js',),
  output: 'vendor-copied',
  depends: bundle_vendor,
  build_by_default: true,
  command: [
    'sh',
    '-c', 'mkdir -p @0@/vendor && cp @INPUT0@ @INPUT1@ @0@/vendor/'.format(tsc_out),
  ],
)

typescript = custom_target(
  'typescript-compile',
  input: sources,
  depends: copy_vendor,
  build_by_default: true,
  build_always_stale: true,
  command: [
    tsc,
    '--project', meson.project_source_root() / 'tsconfig.json',
    '--outDir', tsc_out,
  ],
  output: ['tsc-output'],
)

src_res = gnome.compile_resources(
  'org.savebutton.SaveButton.src',
  'org.savebutton.SaveButton.src.gresource.xml',
  dependencies: typescript,
  source_dir: tsc_out,
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)

bin_conf = configuration_data()
bin_conf.set('GJS', gjs_console)
bin_conf.set('PACKAGE_VERSION', meson.project_version())
bin_conf.set('PACKAGE_NAME', meson.project_name())
bin_conf.set('prefix', get_option('prefix'))
bin_conf.set('libdir', join_paths(get_option('prefix'), get_option('libdir')))
bin_conf.set('datadir', join_paths(get_option('prefix'), get_option('datadir')))
bin_conf.set('resource_path', '/org/savebutton/SaveButton')

app_launcher = configure_file(
  input: 'org.savebutton.SaveButton.in',
  output: 'org.savebutton.SaveButton',
  configuration: bin_conf,
  install: true,
  install_dir: get_option('bindir'),
)

run_target(
  'devel',
  command: [gjs_console, '-m', app_launcher],
  depends: [src_res, data_res, compile_local_schemas],
)