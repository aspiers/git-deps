// Different noty types:
// alert, success, error, warning, information, confirmation
function noty_error(text) {
    notyfication('error', text);
}

function noty_warn(text) {
    notyfication('warning', text);
}

function noty_success(text) {
    notyfication('success', text);
}

function noty_info(text) {
    notyfication('information', text);
}

function noty_debug(text) {
    notyfication('information', text);
}

// Haha, did you see what I did here?
function notyfication(type, text) {
    var n = noty({
        text: text,
        type: type,
        layout: 'topRight',
        theme: 'relax',
        timeout: 30000,  // ms
        animation: {
            open: 'animated bounceInUp',   // Animate.css class names
            close: 'animated bounceOutUp', // Animate.css class names
            easing: 'swing',               // unavailable - no need
            speed: 500                     // unavailable - no need
        }
    });
}
