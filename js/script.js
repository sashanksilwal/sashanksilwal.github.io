// var videography = document.querySelector('.videography');
// var audio = document.querySelector('.sound');
// var about = document.querySelector(".about");
var web = document.querySelector(".web");

var webBgnd = document.querySelector("#canvas1");
// var aboutHTML = document.querySelector("#about-video");
// var sound_wave_Video = document.querySelector("#sound-video");
// var audioSound = document.querySelector("#sound-audio");
// var videographyVideo = document.querySelector("#videography-video");

// //to play the sound when hover
// audio.addEventListener("mouseenter", function (event) {
    
//     sound_wave_Video.style.opacity = 1;
//     audioSound.play();
//   });
// //to stop the sound once the mouse leaves
// audio.addEventListener("mouseout", function (event) {
//     audioSound.pause();
//     sound_wave_Video.style.opacity = 0;
//     audioSound.currentTime = 0;
//     sound_wave_Video.currentTime = 0;
// });


//to disply the background for web design 
web.addEventListener("mouseenter", function (event) {
    webBgnd.style.opacity = 1;
  });

web.addEventListener("mouseout", function (event) {
    // webBgnd.style.display = "none";
    webBgnd.style.opacity = 0;
});


// //display the programming video
// about.addEventListener("mouseenter", function (event) {
//     aboutHTML.style.opacity = 1;
//     // document.body.style.color  = "white";
//   });

// about.addEventListener("mouseout", function (event) {
//     aboutHTML.style.opacity = 0;
// });


// //display the videography video
// videography.addEventListener("mouseenter", function (event) {
//     videographyVideo.style.opacity = 1;
//   });
// videography.addEventListener("mouseout", function (event) {
//     videographyVideo.style.opacity = 0;
// });


// loader
window.addEventListener("load", ()=>{
    const loader = document.querySelector(".loader");
    loader.className += " hidden";
});


// function muteAudio(){
//   let muteAudio = document.getElementById("mute");
//   let playAudio = document.getElementById("unmute")
//   audioSound.muted = false;
//   muteAudio.style.display = "none";
//   playAudio.style.display = "block";

// }

// function unmuteAudio(){
//   let muteAudio = document.getElementById("mute");
//   let playAudio = document.getElementById("unmute")
//   audioSound.muted = true;
//   muteAudio.style.display = "block";
//   playAudio.style.display = "none";
// }