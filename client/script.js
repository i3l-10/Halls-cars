// متغيرات عامة
let currentUser = null;
let currentOwner = null;
let currentAdmin = null;
let currentVenue = null;
let currentBooking = null;

// تهيء التطبيق
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadUserData();
});

// تهيء التطبيق
function initializeApp() {
    // تحقق من وجود مستخدم مسجل دخوله
    const user = localStorage.getItem('currentUser');
    if (user) {
        currentUser = JSON.parse(user);
        updateUIForUser();
    }
    
    const owner = localStorage.getItem('currentOwner');
    if (owner) {
        currentOwner = JSON.parse(owner);
        updateUIForOwner();
    }
    
    const admin = localStorage.getItem('currentAdmin');
    if (admin) {
        currentAdmin = JSON.parse(admin);
        updateUIForAdmin();
    }
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // مستمعي الأحداث لواجهة المستخدم
    document.getElementById('loginForm').addEventListener('submit', handleUserLogin);
    document.getElementById('registerForm').addEventListener('submit', handleUserRegister);
    document.getElementById('otpForm').addEventListener('submit', handleOTPVerification);
    document.getElementById('searchForm').addEventListener('submit', handleSearch);
    document.getElementById('bookingForm').addEventListener('submit', handleBooking);
    document.getElementById('reviewForm').addEventListener('submit', handleReview);
    
    // مستمعي الأحداث لصاحب القاعة
    document.getElementById('ownerLoginForm').addEventListener('submit', handleOwnerLogin);
    document.getElementById('ownerRegisterForm').addEventListener('submit', handleOwnerRegister);
    document.getElementById('createVenueForm').addEventListener('submit', handleCreateVenue);
    
    // مستمعي الأحداث للأدمن
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
    document.getElementById('addSubscriptionForm').addEventListener('submit', handleAddSubscription);
    
    // مستمعي الأحداث للتقييم
    document.querySelectorAll('.rating-star').forEach(star => {
        star.addEventListener('click', handleRatingClick);
        star.addEventListener('mouseenter', handleRatingHover);
    });
    
    document.querySelector('.rating').addEventListener('mouseleave', handleRatingLeave);
}

// وظائف المستخدم
function showLogin() {
    const modal = new bootstrap.Modal(document.getElementById('loginModal'));
    modal.show();
}

function showRegister() {
    const modal = new bootstrap.Modal(document.getElementById('registerModal'));
    modal.show();
}

function showOTPVerification() {
    const modal = new bootstrap.Modal(document.getElementById('otpModal'));
    modal.show();
}

function handleUserLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUIForUser();
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            showNotification('تم تسجيل الدخول بنجاح', 'success');
            loadUserBookings();
            loadUserFavorites();
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function handleUserRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    
    fetch('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, phone, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showOTPVerification();
            document.getElementById('otpForm').dataset.userId = data.user_id;
            showNotification('تم التسجيل بنجاح. يرجى التحقق من OTP.', 'success');
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function handleOTPVerification(e) {
    e.preventDefault();
    const user_id = document.getElementById('otpForm').dataset.userId;
    const otp = document.getElementById('otpCode').value;
    
    fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id, otp })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('otpModal')).hide();
            showNotification('تم التحقق من الحساب بنجاح', 'success');
            // في التطبيق الفعلي، يجب إعادة توجيه المستخدم إلى صفحة تسجيل الدخول
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function updateUIForUser() {
    document.getElementById('userMenu').classList.remove('d-none');
    document.getElementById('authButtons').classList.add('d-none');
    document.getElementById('userName').textContent = currentUser.name;
}

function logout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    location.reload();
}

// وظائف البحث
function handleSearch(e) {
    e.preventDefault();
    const type = document.getElementById('venueType').value;
    const location = document.getElementById('location').value;
    const minPrice = document.getElementById('minPrice').value;
    const maxPrice = document.getElementById('maxPrice').value;
    
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (location) params.append('location', location);
    if (minPrice) params.append('min_price', minPrice);
    if (maxPrice) params.append('max_price', maxPrice);
    
    fetch(`/api/venues?${params}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayVenues(data.venues);
            } else {
                showNotification(data.error, 'error');
            }
        })
        .catch(error => {
            showNotification('خطأ في الاتصال بالخادم', 'error');
        });
}

function displayVenues(venues) {
    const venuesList = document.getElementById('venuesList');
    venuesList.innerHTML = '';
    
    if (venues.length === 0) {
        venuesList.innerHTML = '<div class="col-12 text-center py-5"><h5>لا توجد أماكن متطابقة مع معايير البحث</h5></div>';
        return;
    }
    
    venues.forEach(venue => {
        const venueCard = createVenueCard(venue);
        venuesList.appendChild(venueCard);
    });
}

function createVenueCard(venue) {
    const col = document.createElement('div');
    col.className = 'col-md-4 col-lg-3 mb-4';
    
    col.innerHTML = `
        <div class="card venue-card h-100">
            ${venue.status === 'pending' ? '<span class="venue-badge badge-pending">قيد المراجعة</span>' : ''}
            <img src="${venue.primary_image || 'https://picsum.photos/seed/venue' + venue.id + '/400/300.jpg'}" 
                 class="card-img-top venue-image" alt="${venue.name}">
            <div class="card-body">
                <h5 class="card-title">${venue.name}</h5>
                <p class="card-text text-muted">${venue.location}</p>
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-primary fw-bold">${venue.price_per_night} ريال/ليلة</span>
                    <div class="rating text-warning">
                        ${generateStars(venue.average_rating || 0)}
                        <small class="text-muted">(${venue.review_count || 0})</small>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-primary btn-sm flex-fill" onclick="showVenueDetail(${venue.id})">
                        <i class="fas fa-eye me-1"></i> التفاصيل
                    </button>
                    <button class="btn btn-outline-primary btn-sm" onclick="addToFavorites(${venue.id})">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star"></i>';
        } else if (i - 0.5 <= rating) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        } else {
            stars += '<i class="far fa-star"></i>';
        }
    }
    return stars;
}

function showVenueDetail(venueId) {
    fetch(`/api/venues/${venueId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentVenue = data.venue;
                displayVenueDetail(currentVenue);
                const modal = new bootstrap.Modal(document.getElementById('venueDetailModal'));
                modal.show();
            } else {
                showNotification(data.error, 'error');
            }
        })
        .catch(error => {
            showNotification('خطأ في الاتصال بالخادم', 'error');
        });
}

function displayVenueDetail(venue) {
    const modalTitle = document.getElementById('venueDetailTitle');
    const modalContent = document.getElementById('venueDetailContent');
    
    modalTitle.textContent = venue.name;
    
    modalContent.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <img src="${venue.primary_image || 'https://picsum.photos/seed/venue' + venue.id + '/600/400.jpg'}" 
                     class="img-fluid rounded mb-3" alt="${venue.name}">
                ${venue.images && venue.images.length > 1 ? `
                    <div class="venue-gallery">
                        ${venue.images.slice(1, 4).map(img => `
                            <img src="${img}" alt="${venue.name}">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="col-md-6">
                <h4>${venue.name}</h4>
                <p class="text-muted">${venue.location}</p>
                <p>${venue.description}</p>
                
                <div class="mb-3">
                    <h6>وسائل الراحة:</h6>
                    <div class="d-flex flex-wrap gap-2">
                        ${venue.amenities ? venue.amenities.split(',').map(amenity => `
                            <span class="badge bg-secondary">${amenity.trim()}</span>
                        `).join('') : '<span class="text-muted">لا توجد وسائل راحة محددة</span>'}
                    </div>
                </div>
                
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <span class="h5 text-primary">${venue.price_per_night} ريال/ليلة</span>
                    <div class="rating">
                        ${generateStars(venue.average_rating || 0)}
                        <small class="text-muted">(${venue.review_count || 0} مراجعة)</small>
                    </div>
                </div>
                
                <div class="d-grid gap-2">
                    <button class="btn btn-primary" onclick="showBookingModal()">
                        <i class="fas fa-calendar-check me-2"></i> حجز الآن
                    </button>
                    <button class="btn btn-outline-primary" onclick="showReviews(${venue.id})">
                        <i class="fas fa-star me-2"></i> عرض المراجعات
                    </button>
                </div>
            </div>
        </div>
    `;
}

function showBookingModal() {
    if (!currentUser) {
        showNotification('يرجى تسجيل الدخول أولاً', 'warning');
        showLogin();
        return;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('bookingModal'));
    document.getElementById('totalPrice').value = currentVenue.price_per_night + ' ريال';
    modal.show();
}

function handleBooking(e) {
    e.preventDefault();
    const checkInDate = document.getElementById('checkInDate').value;
    const checkOutDate = document.getElementById('checkOutDate').value;
    const totalPrice = document.getElementById('totalPrice').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    
    const startDate = new Date(checkInDate);
    const endDate = new Date(checkOutDate);
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const pricePerNight = parseFloat(currentVenue.price_per_night);
    const calculatedTotal = nights * pricePerNight;
    
    fetch('/api/bookings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            venue_id: currentVenue.id,
            user_id: currentUser.id,
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            total_price: calculatedTotal
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('bookingModal')).hide();
            showNotification('تم إنشاء الحجز بنجاح', 'success');
            loadUserBookings();
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function handleReview(e) {
    e.preventDefault();
    const rating = document.getElementById('rating').value;
    const comment = document.getElementById('reviewComment').value;
    
    fetch('/api/reviews', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            booking_id: currentBooking.id,
            user_id: currentUser.id,
            venue_id: currentVenue.id,
            rating: rating,
            comment: comment
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('reviewModal')).hide();
            showNotification('تم إضافة المراجعة بنجاح', 'success');
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function handleRatingClick(e) {
    const rating = parseInt(e.target.dataset.rating);
    document.getElementById('rating').value = rating;
    
    document.querySelectorAll('.rating-star').forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
            star.classList.remove('far');
            star.classList.add('fas');
        } else {
            star.classList.remove('active');
            star.classList.add('far');
            star.classList.remove('fas');
        }
    });
}

function handleRatingHover(e) {
    const rating = parseInt(e.target.dataset.rating);
    
    document.querySelectorAll('.rating-star').forEach((star, index) => {
        if (index < rating) {
            star.style.color = '#ffc107';
        } else {
            star.style.color = '#ddd';
        }
    });
}

function handleRatingLeave() {
    const rating = parseInt(document.getElementById('rating').value) || 0;
    
    document.querySelectorAll('.rating-star').forEach((star, index) => {
        if (index < rating) {
            star.style.color = '#ffc107';
        } else {
            star.style.color = '#ddd';
        }
    });
}

function addToFavorites(venueId) {
    if (!currentUser) {
        showNotification('يرجى تسجيل الدخول أولاً', 'warning');
        showLogin();
        return;
    }
    
    fetch('/api/favorites', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: currentUser.id,
            venue_id: venueId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message, 'success');
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function loadUserBookings() {
    if (!currentUser) return;
    
    fetch(`/api/bookings/${currentUser.id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayBookings(data.bookings);
            }
        })
        .catch(error => {
            console.error('Error loading bookings:', error);
        });
}

function displayBookings(bookings) {
    const bookingsList = document.getElementById('bookingsList');
    bookingsList.innerHTML = '';
    
    if (bookings.length === 0) {
        bookingsList.innerHTML = '<div class="col-12 text-center py-5"><h5>لا توجد حجوزات سابقة</h5></div>';
        return;
    }
    
    bookings.forEach(booking => {
        const bookingCard = createBookingCard(booking);
        bookingsList.appendChild(bookingCard);
    });
}

function createBookingCard(booking) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4 mb-4';
    
    const statusClass = booking.status === 'confirmed' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'warning';
    const statusText = booking.status === 'confirmed' ? 'مؤكد' : booking.status === 'cancelled' ? 'ملغى' : 'قيد المراجعة';
    
    col.innerHTML = `
        <div class="card h-100">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="card-title">${booking.venue_name}</h5>
                    <span class="badge bg-${statusClass}">${statusText}</span>
                </div>
                <p class="card-text text-muted">${booking.venue_location}</p>
                <div class="mb-2">
                    <small class="text-muted">تاريخ الوصول: ${booking.check_in_date}</small>br>
                    <small< class="text-muted">تاريخ المغادرة: ${booking.check_out_date}</small>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="h6 text-primary">${booking.total_price} ريال</span>
                    <div class="d-flex gap-1">
                        ${booking.status === 'confirmed' ? `
                            <button class="btn btn-outline-primary btn-sm" onclick="showReviewForBooking(${booking.id})">
                                <i class="fas fa-star"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-outline-secondary btn-sm" onclick="showBookingDetails(${booking.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

function loadUserFavorites() {
    if (!currentUser) return;
    
    fetch(`/api/favorites/${currentUser.id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayFavorites(data.favorites);
            }
        })
        .catch(error => {
            console.error('Error loading favorites:', error);
        });
}

function displayFavorites(favorites) {
    const favoritesList = document.getElementById('favoritesList');
    favoritesList.innerHTML = '';
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<div class="col-12 text-center py-5"><h5>لا توجد أماكن في المفضلة</h5></div>';
        return;
    }
    
    favorites.forEach(favorite => {
        const favoriteCard = createVenueCard(favorite);
        // إضافة زر إزالة من المفضلة
        const removeBtn = favoriteCard.querySelector('.btn-outline-primary');
        removeBtn.innerHTML = '<i class="fas fa-heart-broken"></i>';
        removeBtn.onclick = () => removeFromFavorites(favorite.id);
        favoritesList.appendChild(favoriteCard);
    });
}

function removeFromFavorites(venueId) {
    if (!currentUser) return;
    
    fetch('/api/favorites', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: currentUser.id,
            venue_id: venueId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message, 'success');
            loadUserFavorites();
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

// وظائف صاحب القاعة
function showOwnerLogin() {
    const modal = new bootstrap.Modal(document.getElementById('ownerLoginModal'));
    modal.show();
}

function showOwnerRegister() {
    const modal = new bootstrap.Modal(document.getElementById('ownerRegisterModal'));
    modal.show();
}

function handleOwnerLogin(e) {
    e.preventDefault();
    const email = document.getElementById('ownerLoginEmail').value;
    const password = document.getElementById('ownerLoginPassword').value;
    
    // في التطبيق الفعلي، يجب استدعاء API مختلف لصاحب القاعة
    fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // التحقق من أن المستخدم هو صاحب قاعة
            if (data.user.user_type === 'venue_owner') {
                currentOwner = data.user;
                localStorage.setItem('currentOwner', JSON.stringify(currentOwner));
                updateUIForOwner();
                bootstrap.Modal.getInstance(document.getElementById('ownerLoginModal')).hide();
                showNotification('تم تسجيل الدخول بنجاح', 'success');
                loadOwnerDashboard();
            } else {
                showNotification('هذا الحساب ليس لحساب صاحب قاعة', 'error');
            }
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function handleOwnerRegister(e) {
    e.preventDefault();
    const name = document.getElementById('ownerRegisterName').value;
    const email = document.getElementById('ownerRegisterEmail').value;
    const phone = document.getElementById('ownerRegisterPhone').value;
    const businessName = document.getElementById('businessName').value;
    const businessLicense = document.getElementById('businessLicense').value;
    const password = document.getElementById('ownerRegisterPassword').value;
    
    fetch('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            name, 
            email, 
            phone, 
            password,
            user_type: 'venue_owner'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // إنشاء سجل لصاحب القاعة
            return fetch('/api/venue-owners', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: data.user_id,
                    business_name: businessName,
                    business_license: businessLicense
                })
            });
        } else {
            throw new Error(data.error);
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('تم إنشاء حساب صاحب القاعة بنجاح', 'success');
            bootstrap.Modal.getInstance(document.getElementById('ownerRegisterModal')).hide();
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function updateUIForOwner() {
    document.getElementById('ownerMenu').classList.remove('d-none');
    document.getElementById('ownerAuthButtons').classList.add('d-none');
    document.getElementById('ownerName').textContent = currentOwner.name;
}

function ownerLogout() {
    localStorage.removeItem('currentOwner');
    currentOwner = null;
    location.reload();
}

function showCreateVenue() {
    const modal = new bootstrap.Modal(document.getElementById('createVenueModal'));
    modal.show();
}

function handleCreateVenue(e) {
    e.preventDefault();
    const name = document.getElementById('venueName').value;
    const type = document.getElementById('venueType').value;
    const description = document.getElementById('venueDescription').value;
    const location = document.getElementById('venueLocation').value;
    const latitude = document.getElementById('venueLatitude').value;
    const longitude = document.getElementById('venueLongitude').value;
    const price = document.getElementById('venuePrice').value;
    
    const amenities = [];
    if (document.getElementById('wifi').checked) amenities.push('واي فاي');
    if (document.getElementById('parking').checked) amenities.push('مواقف');
    if (document.getElementById('ac').checked) amenities.push('تكييف');
    if (document.getElementById('kitchen').checked) amenities.push('مطبخ');
    
    const amenitiesString = amenities.join(',');
    
    // في التطبيق الفعلي، يجب الحصول على owner_id من قاعدة البيانات
    const ownerId = 1; // هذا يجب أن يتم استرداده من قاعدة البيانات
    
    fetch('/api/venues', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            owner_id: ownerId,
            name,
            description,
            type,
            location,
            latitude,
            longitude,
            price_per_night: price,
            amenities: amenitiesString
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('createVenueModal')).hide();
            showNotification('تم إنشاء المكان بنجاح. في انتظار موافقة الأدمن.', 'success');
            loadOwnerVenues();
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function loadOwnerDashboard() {
    // تحميل إحصائيات لوحة التحكم
    fetch('/api/admin/stats')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // تحديث الإحصائيات (هذا مثال فقط)
                document.getElementById('activeVenues').textContent = data.stats.total_venues;
                document.getElementById('activeBookings').textContent = data.stats.total_bookings;
            }
        })
        .catch(error => {
            console.error('Error loading dashboard stats:', error);
        });
}

function loadOwnerVenues() {
    // تحميل أماكن صاحب القاعة
    fetch('/api/venues/owner')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayOwnerVenues(data.venues);
            }
        })
        .catch(error => {
            console.error('Error loading owner venues:', error);
        });
}

function displayOwnerVenues(venues) {
    const venuesList = document.getElementById('myVenuesList');
    venuesList.innerHTML = '';
    
    if (venues.length === 0) {
        venuesList.innerHTML = '<div class="col-12 text-center py-5"><h5>لا توجد أماكن مسجلة</h5></div>';
        return;
    }
    
    venues.forEach(venue => {
        const venueCard = createOwnerVenueCard(venue);
        venuesList.appendChild(venueCard);
    });
}

function createOwnerVenueCard(venue) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4 mb-4';
    
    const statusClass = venue.status === 'approved' ? 'success' : venue.status === 'pending' ? 'warning' : 'danger';
    const statusText = venue.status === 'approved' ? 'موافق عليه' : venue.status === 'pending' ? 'قيد المراجعة' : 'مرفوض';
    
    col.innerHTML = `
        <div class="card h-100">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="card-title">${venue.name}</h5>
                    <span class="badge bg-${statusClass}">${statusText}</span>
                </div>
                <p class="card-text text-muted">${venue.location}</p>
                <div class="mb-2">
                    <small class="text-muted">النوع: ${venue.type === 'hall' ? 'قاعة' : venue.type === 'chalet' ? 'شاليه' : 'سيارة'}</small>br>
                    <small< class="text-muted">السعر: ${venue.price_per_night} ريال/ليلة</small>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-primary btn-sm flex-fill" onclick="editVenue(${venue.id})">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteVenue(${venue.id})">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

// وظائف الأدمن
function showAdminLogin() {
    const modal = new bootstrap.Modal(document.getElementById('adminLoginModal'));
    modal.show();
}

function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    
    // في التطبيق الفعلي، يجب التحقق من بيانات الاعتماد الخاصة بالأدمن
    if (username === 'admin' && password === 'admin123') {
        currentAdmin = { id: 1, name: 'Admin', username: 'admin' };
        localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));
        updateUIForAdmin();
        bootstrap.Modal.getInstance(document.getElementById('adminLoginModal')).hide();
        showNotification('تم تسجيل الدخول بنجاح', 'success');
        loadAdminDashboard();
    } else {
        showNotification('اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
    }
}

function updateUIForAdmin() {
    document.getElementById('adminMenu').classList.remove('d-none');
    document.getElementById('adminAuthButtons').classList.add('d-none');
    document.getElementById('adminName').textContent = currentAdmin.name;
}

function adminLogout() {
    localStorage.removeItem('currentAdmin');
    currentAdmin = null;
    location.reload();
}

function loadAdminDashboard() {
    // تحميل إحصائيات لوحة التحكم
    fetch('/api/admin/stats')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateAdminStats(data.stats);
                loadPendingVenues();
                loadPendingBookings();
            }
        })
        .catch(error => {
            console.error('Error loading admin dashboard:', error);
        });
}

function updateAdminStats(stats) {
    document.getElementById('totalUsers').textContent = stats.total_users;
    document.getElementById('approvedVenues').textContent = stats.total_venues;
    document.getElementById('pendingVenues').textContent = stats.total_pending_venues;
    document.getElementById('activeBookings').textContent = stats.total_bookings;
}

function loadPendingVenues() {
    fetch('/api/admin/pending-venues')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayPendingVenues(data.venues);
            }
        })
        .catch(error => {
            console.error('Error loading pending venues:', error);
        });
}

function displayPendingVenues(venues) {
    const pendingVenues = document.getElementById('adminPendingVenues');
    pendingVenues.innerHTML = '';
    
    if (venues.length === 0) {
        pendingVenues.innerHTML = '<div class="text-center py-3">لا توجد أماكن قيد المراجعة</div>';
        return;
    }
    
    venues.forEach(venue => {
        const venueItem = document.createElement('div');
        venueItem.className = 'list-group-item';
        venueItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${venue.name}</h6>
                    <p class="mb-1 text-muted">${venue.owner_name} - ${venue.owner_phone}</p>
                    <small class="text-muted">${venue.created_at}</small>
                </div>
                <div>
                    <button class="btn btn-success btn-sm me-2" onclick="approveVenue(${venue.id})">
                        <i class="fas fa-check"></i> الموافقة
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="rejectVenue(${venue.id})">
                        <i class="fas fa-times"></i> الرفض
                    </button>
                </div>
            </div>
        `;
        pendingVenues.appendChild(venueItem);
    });
}

function approveVenue(venueId) {
    updateVenueStatus(venueId, 'approved');
}

function rejectVenue(venueId) {
    updateVenueStatus(venueId, 'rejected');
}

function updateVenueStatus(venueId, status) {
    fetch(`/api/admin/venues/${venueId}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message, 'success');
            loadAdminDashboard();
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function loadPendingBookings() {
    fetch('/api/admin/bookings')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayPendingBookings(data.bookings);
            }
        })
        .catch(error => {
            console.error('Error loading pending bookings:', error);
        });
}

function displayPendingBookings(bookings) {
    const pendingBookings = document.getElementById('adminPendingBookings');
    pendingBookings.innerHTML = '';
    
    const pendingBookingsList = bookings.filter(b => b.status === 'pending');
    
    if (pendingBookingsList.length === 0) {
        pendingBookings.innerHTML = '<div class="text-center py-3">لا توجد حجوزات قيد المراجعة</div>';
        return;
    }
    
    pendingBookingsList.slice(0, 5).forEach(booking => {
        const bookingItem = document.createElement('div');
        bookingItem.className = 'list-group-item';
        bookingItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${booking.venue_name}</h6>
                    <p class="mb-1 text-muted">${booking.user_name} - ${booking.user_email}</p>
                    <small class="text-muted">${booking.check_in_date} إلى ${booking.check_out_date}</small>
                </div>
                <div>
                    <button class="btn btn-success btn-sm me-2" onclick="confirmBooking(${booking.id})">
                        <i class="fas fa-check"></i> تأكيد
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="cancelBooking(${booking.id})">
                        <i class="fas fa-times"></i> إلغاء
                    </button>
                </div>
            </div>
        `;
        pendingBookings.appendChild(bookingItem);
    });
}

function confirmBooking(bookingId) {
    updateBookingStatus(bookingId, 'confirmed');
}

function cancelBooking(bookingId) {
    updateBookingStatus(bookingId, 'cancelled');
}

function updateBookingStatus(bookingId, status) {
    fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message, 'success');
            loadAdminDashboard();
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

function showAddSubscriptionModal() {
    // تحميل قائمة أصحاب القاعة
    fetch('/api/venue-owners')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const select = document.getElementById('subscriptionOwner');
                select.innerHTML = '<option value="">اختر صاحب القاعة</option>';
                data.owners.forEach(owner => {
                    const option = document.createElement('option');
                    option.value = owner.id;
                    option.textContent = owner.business_name;
                    select.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('Error loading venue owners:', error);
        });
    
    const modal = new bootstrap.Modal(document.getElementById('addSubscriptionModal'));
    modal.show();
}

function handleAddSubscription(e) {
    e.preventDefault();
    const ownerId = document.getElementById('subscriptionOwner').value;
    const type = document.getElementById('subscriptionType').value;
    const price = document.getElementById('subscriptionPrice').value;
    const startDate = document.getElementById('subscriptionStartDate').value;
    const endDate = document.getElementById('subscriptionEndDate').value;
    
    fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            venue_owner_id: ownerId,
            type,
            price,
            start_date: startDate,
            end_date: endDate
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('addSubscriptionModal')).hide();
            showNotification('تم إضافة الاشتراك بنجاح', 'success');
            loadSubscriptions();
        } else {
            showNotification(data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('خطأ في الاتصال بالخادم', 'error');
    });
}

// وظائف مساعدة
function showNotification(message, type = 'info') {
    const alertClass = `alert-${type}-custom`;
    const alertHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    const alertContainer = document.createElement('div');
    alertContainer.innerHTML = alertHtml;
    document.body.insertBefore(alertContainer, document.body.firstChild);
    
    // إخفاء التنبيه بعد 5 ثوانٍ
    setTimeout(() => {
        const alert = document.querySelector('.alert');
        if (alert) {
            alert.remove();
        }
    }, 5000);
}

function showProfile() {
    if (!currentUser) return;
    
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileNameInfo').textContent = currentUser.name;
    document.getElementById('profileEmailInfo').textContent = currentUser.email;
    document.getElementById('profilePhone').textContent = currentUser.phone;
    
    const modal = new bootstrap.Modal(document.getElementById('profileModal'));
    modal.show();
}

function showOwnerProfile() {
    if (!currentOwner) return;
    
    // تحميل إحصائيات صاحب القاعة
    fetch(`/api/owner/stats/${currentOwner.id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('totalBookings').textContent = data.total_bookings;
                document.getElementById('totalReviews').textContent = data.total_reviews;
            }
        })
        .catch(error => {
            console.error('Error loading owner stats:', error);
        });
    
    const modal = new bootstrap.Modal(document.getElementById('profileModal'));
    modal.show();
}

function showAdminProfile() {
    if (!currentAdmin) return;
    
    const modal = new bootstrap.Modal(document.getElementById('profileModal'));
    modal.show();
}

function resendOTP() {
    showNotification('تم إعادة إرسال OTP', 'success');
}

// وظائف إضافية
function editVenue(venueId) {
    // فتح نموذج التعديل
    showNotification('وظيفة التعديل قيد التطوير', 'info');
}

function deleteVenue(venueId) {
    if (confirm('هل أنت متأكد من حذف هذا المكان؟')) {
        fetch(`/api/venues/${venueId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('تم حذف المكان بنجاح', 'success');
                loadOwnerVenues();
            } else {
                showNotification(data.error, 'error');
            }
        })
        .catch(error => {
            showNotification('خطأ في الاتصال بالخادم', 'error');
        });
    }
}

function showBookingDetails(bookingId) {
    // عرض تفاصيل الحجز
    showNotification('وظيفة عرض التفاصيل قيد التطوير', 'info');
}

function showReviewForBooking(bookingId) {
    currentBooking = { id: bookingId };
    const modal = new bootstrap.Modal(document.getElementById('reviewModal'));
    modal.show();
}

function showReviews(venueId) {
    // عرض المراجعات للمكان
    showNotification('وظيفة عرض المراجعات قيد التطوير', 'info');
}

function loadSubscriptions() {
    // تحميل الاشتراكات
    fetch('/api/admin/subscriptions')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displaySubscriptions(data.subscriptions);
            }
        })
        .catch(error => {
            console.error('Error loading subscriptions:', error);
        });
}

function displaySubscriptions(subscriptions) {
    const subscriptionsList = document.getElementById('subscriptionsList');
    subscriptionsList.innerHTML = '';
    
    if (subscriptions.length === 0) {
        subscriptionsList.innerHTML = '<tr><td colspan="8" class="text-center">لا توجد اشتراكات</td></tr>';
        return;
    }
    
    subscriptions.forEach(subscription => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${subscription.id}</td>
            <td>${subscription.business_name}</td>
            <td>${subscription.type === 'basic' ? 'Basic' : 'Premium'}</td>
            <td>${subscription.price} ريال</td>
            <td>${subscription.start_date}</td>
            <td>${subscription.end_date}</td>
            td><span class="badge bg-${subscription.status === 'active' ? 'success' : subscription.status === 'expired' ? 'danger' : 'warning'}">${subscription.status}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editSubscription(${subscription.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteSubscription(${subscription.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        subscriptionsList.appendChild(row);
    });
}

function editSubscription(subscriptionId) {
    // تعديل الاشتراك
    showNotification('وظيفة تعديل الاشتراك قيد التطوير', 'info');
}

function deleteSubscription(subscriptionId) {
    if (confirm('هل أنت متأكد من حذف هذا الاشتراك؟')) {
        fetch(`/api/admin/subscriptions/${subscriptionId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('تم حذف الاشتراك بنجاح', 'success');
                loadSubscriptions();
            } else {
                showNotification(data.error, 'error');
            }
        })
        .catch(error => {
            showNotification('خطأ في الاتصال بالخادم', 'error');
        });
    }
}

// وظائف التحميل الأولي
function loadUserData() {
    // التحقق من وجود مستخدم مسجل دخوله
    const user = localStorage.getItem('currentUser');
    if (user) {
        currentUser = JSON.parse(user);
        updateUIForUser();
    }
    
    const owner = localStorage.getItem('currentOwner');
    if (owner) {
        currentOwner = JSON.parse(owner);
        updateUIForOwner();
    }
    
    const admin = localStorage.getItem('currentAdmin');
    if (admin) {
        currentAdmin = JSON.parse(admin);
        updateUIForAdmin();
    }
}

// إعداد تطبيق Vue.js (اختياري - يمكن إزالته إذا لم تكن بحاجة إليه)
if (typeof Vue !== 'undefined') {
    new Vue({
        el: '#app',
        data: {
            message: 'مرحباً بك في تطبيق الحجز المتكامل'
        }
    });
}
