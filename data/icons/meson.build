application_id = 'org.savebutton.SaveButton'

# Install scalable SVG icon
scalable_dir = join_paths('hicolor', 'scalable', 'apps')
install_data(
  join_paths(scalable_dir, ('@0@.svg').format(application_id)),
  install_dir: join_paths(get_option('datadir'), 'icons', scalable_dir),
)

# Install symbolic icon
symbolic_dir = join_paths('hicolor', 'symbolic', 'apps')
install_data(
  join_paths(symbolic_dir, ('@0@-symbolic.svg').format(application_id)),
  install_dir: join_paths(get_option('datadir'), 'icons', symbolic_dir),
)

# Install PNG icons in various sizes
icon_sizes = ['16x16', '32x32', '48x48', '64x64', '128x128', '256x256']
foreach size : icon_sizes
  size_dir = join_paths('hicolor', size, 'apps')
  install_data(
    join_paths(size_dir, ('@0@.png').format(application_id)),
    install_dir: join_paths(get_option('datadir'), 'icons', size_dir),
  )
endforeach