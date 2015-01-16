noty = require "noty"

# Different noty types:
# alert, success, error, warning, information, confirmation
noty_error   = (text) -> notyfication "error",       text
noty_warn    = (text) -> notyfication "warning",     text
noty_success = (text) -> notyfication "success",     text
noty_info    = (text) -> notyfication "information", text
noty_debug   = (text) -> notyfication "information", text

# "notyfication" - haha, did you see what I did there?
notyfication = (type, text) ->
  noty(
    text: text
    type: type
    layout: "topRight"
    theme: "relax"
    maxVisible: 15
    timeout: 30000 # ms
    animation:
      open: "animated bounceInUp" # Animate.css class names
      close: "animated bounceOutUp" # Animate.css class names
      easing: "swing" # unavailable - no need
      speed: 500 # unavailable - no need
  )

module.exports =
  error: noty_error
  warn: noty_warn
  success: noty_success
  info: noty_info
  debug: noty_debug
