// code
  const images = document.querySelectorAll(".track img");
  const track = document.querySelector(".track");

  let currentIndex = 1; // center image index

  function updateCarousel() {
    images.forEach(img => img.classList.remove("active"));
    images[currentIndex].classList.add("active");

    // Move track so current image is centered
    const imageWidth = 150;
    const centerOffset = 300 / 2 - imageWidth / 2;
    const translateX = -(currentIndex * imageWidth) + centerOffset;

    track.style.transform = `translateX(${translateX}px)`;
  }
/*
  updateCarousel();

  setInterval(() => {
    currentIndex = (currentIndex + 1) % images.length;
    updateCarousel();
  }, 5000);
*/