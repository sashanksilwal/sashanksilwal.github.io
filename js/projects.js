const track = document.querySelector(".carousel_track")
const slides = Array.from(track.children);
const nextBtn = document.querySelector(".button--right");
const prevBtn = document.querySelector(".button--left");
const dotsNav = document.querySelector(".carousel_nav")
const dots = Array.from(dotsNav.children);

const slideWidth = slides[0].getBoundingClientRect().width;
// console.log(slideWidth)

//arange the slide next to each other
const setSlidePosition = (slide, index)=>{
    slide.style.left = slideWidth * index + "px";
}

slides.forEach(setSlidePosition);
// slides[0].style.left = slideWidth*0 + "px";
// slides[1].style.left = slideWidth*1 + "px";
// slides[2].style.left = slideWidth*2 + "px";
// slides[3].style.left = slideWidth*3 + "px";


const moveToSlide = (track, currentSlide, targetSlide)=> {
    track.style.transform = 'translateX(-' + targetSlide.style.left + ')';
    currentSlide.classList.remove("current-slide");
    targetSlide.classList.add("current-slide");
}

const updateDots = (currentDot, targetDot)=>{
    currentDot.classList.remove("current-slide");
    targetDot.classList.add("current-slide");
}

const hideShowArrows = (slides, prevBtn, nextBtn, targetIndex)=>{
    if (targetIndex == 0){
        prevBtn.classList.add("is-hidden");
        nextBtn.classList.remove("is-hidden");
    } else if (targetIndex == slides.length -1){
        prevBtn.classList.remove("is-hidden");
        nextBtn.classList.add("is-hidden");
    } else{
        prevBtn.classList.remove("is-hidden");
        nextBtn.classList.remove("is-hidden");
    }
}
//when I click left move slides to the left
prevBtn.addEventListener("click", ()=>{
    const currentSlide = track.querySelector(".current-slide");
    const prevSlide = currentSlide.previousElementSibling;
    const currentDot = dotsNav.querySelector(".current-slide");
    const prevDot = currentDot.previousElementSibling;
    const prevIndex = slides.findIndex(slide=> slide === prevSlide);
    //move to the slide
    moveToSlide(track, currentSlide, prevSlide);

    updateDots(currentDot, prevDot);
    hideShowArrows(slides, prevBtn, nextBtn, prevIndex);

});

//when I click right move slides to the right
nextBtn.addEventListener("click",()=>{
    const currentSlide = track.querySelector(".current-slide");
    const nextSlide = currentSlide.nextElementSibling;
    const currentDot = dotsNav.querySelector(".current-slide");
    const nextDot = currentDot.nextElementSibling;
    const nextIndex = slides.findIndex(slide=> slide === nextSlide);

    //move to the slide
    moveToSlide(track, currentSlide, nextSlide);

    updateDots(currentDot, nextDot);
    hideShowArrows(slides, prevBtn, nextBtn, nextIndex);


});

//when I click the nav indicator, move to that slide 

dotsNav.addEventListener("click", e => {
    //what indicator was cliced on
    const targetDot = e.target.closest("button");
    if (!targetDot) return;

    const currentSlide = track.querySelector(".current-slide");
    const currentDot = dotsNav.querySelector(".current-slide");
    const targetIndex = dots.findIndex(dot => dot === targetDot);
    const targetSlide = slides[targetIndex];

    moveToSlide(track, currentSlide, targetSlide);
    updateDots(currentDot, targetDot);

    hideShowArrows(slides, prevBtn, nextBtn, targetIndex);
    
})

