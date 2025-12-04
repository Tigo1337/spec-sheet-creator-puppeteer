{ pkgs }: {
  deps = [
    pkgs.nodejs-20_x
    pkgs.chromium
    pkgs.glib
    pkgs.nss
    pkgs.fontconfig
  ];
}