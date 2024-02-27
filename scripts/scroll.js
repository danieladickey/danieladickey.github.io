// JavaScript to fade in navbar logo based on y position of page
// Logo fades in/out based on user scrolling location

const bootStrapMobileWidth = 767; // this is set by Bootstrap 4 used to determine if screen is mobile
const headerHeight = document.querySelector("#header").offsetHeight; // height of big logo image header
const verticalMax = 1000; // how far down on page to reach max opacity (larger number means the logo fades in more slowly)
const navSpacer = // duplicate of small nav logo placed on the right side to assist in centering menu
    `<a id="nav-spacer" class="navbar-brand" href="./index.html"><img
    src="https://storage.googleapis.com/danieladickey_com/dad/images/logos/logo_nobg_dad.png"
    height="25" class="d-inline-block align-text-top"></a>`

var verticalLocation = getVertLoc(); // how far down the page is the user
var isMobile; // is the user on mobile (based on page width)

addOrRemoveSpacer(); // on page load check
adjustVisibility(); // on page load adjust visibility based on vertical max

// based on how far the user has scrolled down fade in the small logo on the nav bar to avoid having DAD on the screen twice
document.addEventListener("scroll", event => {
    verticalLocation = getVertLoc();
    adjustVisibility();
});

// check if mobile if the browser changes size so right side spacer can be removed to allow hamburger menu to be on the right
window.addEventListener("resize", function () {
    addOrRemoveSpacer();
});

// if scrolled past the large top logo start fading in the small menu logo
// if scrolling up the page fade out the small menu logo before reaching the large top logo
function adjustVisibility() {
    if (verticalLocation > 0) {
        document.querySelector("#nav-logo").style.opacity = verticalLocation / verticalMax;
        document.querySelector("#nav-logo").style.visibility = "visible";
    } else if (verticalLocation < 0) {
        document.querySelector("#nav-logo").style.visibility = "hidden";
    }
}

// add (if not mobile to help center nav links) or remove (if mobile to put menu icon on right) spacer on right side of nav bar
function addOrRemoveSpacer() {
    checkIfMobile();
    if (isMobile && document.querySelector("#nav-spacer") != null) {
        document.querySelector("#nav-spacer").remove();
    } else if (!isMobile && document.querySelector("#nav-spacer") === null) {
        document.querySelector("#nav-container").innerHTML = document.querySelector("#nav-container").innerHTML + navSpacer;
        document.querySelector("#nav-spacer").style.visibility = "hidden";
    }
}

// if the screen width is small then assume mobile
// if screen width is small enough that Bootstrap switches menu to mobile drop down links/tabs
function checkIfMobile() {
    if (window.innerWidth <= bootStrapMobileWidth) {
        isMobile = true;
    }
    else {
        isMobile = false;
    }
}

// vertical location is 0 based on the bottom of the large logo at top of the screen / where the nav bar begins
// scrollY is built in scroll y 0 starts at top of screen and increases as user scrolls down
// subtract the height of the header to get 0 base at top of the nav bar
function getVertLoc() {
    return scrollY - (headerHeight * 0.7);
}