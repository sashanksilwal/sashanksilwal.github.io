var myNav = document.getElementById("nav");
const nav = document.querySelector(".nav-links");


const navslide = ()=>{
    const burger = document.querySelector(".burger");
    const logo = document.querySelector(".logo");
    const navLinks = document.querySelectorAll(".nav-links li");

    burger.addEventListener('click',() => {
        // Toggle Nav
        nav.classList.toggle("nav-active");

        // if (window.scrollY <= 50 ) {
        //     myNav.classList.toggle("nav-bg-color");
        //     myNav.classList.toggle("nav-bg-transparent");
        //     // logo.classList.toggle("hide");
        // } 
        // myNav.classList.toggle("nav-bg-color");
        // myNav.classList.toggle("nav-bg-transparent");

         // Animate links
        navLinks.forEach((link, index)=>{
        if(link.style.animation){
            link.style.animation = '';
        }
        else{
            link.style.animation = `navLinkFade 0.5s ease forwards ${index /7 + 0.3}s`;
        }
        });
        // burger animation
        burger.classList.toggle("toggle");
    });

}

const app = ()=>{
    navslide();
}

app();

window.onscroll = function () { 
    if (window.scrollY >= 50 && !nav.classList.contains("nav-active")) {
        myNav.classList.add("nav-bg-color");
        myNav.classList.remove("nav-bg-transparent");
    } 
    else {
        myNav.classList.add("nav-bg-transparentt");
        myNav.classList.remove("nav-bg-color");
    }
};