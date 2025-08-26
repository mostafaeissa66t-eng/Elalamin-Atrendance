// === المتغيرات والعناصر الأساسية ===
const scriptURL = 'https://script.google.com/macros/s/AKfycbx68ID6PAkrP-QIT6cqHeB0D-iH2V8xBaEZx4dB8sno5Ef70sPvP-wPckStmHveoOWA/exec'; // <-- ضع رابط تطبيق الويب هنا
const form = document.getElementById('attendanceForm');
const submitButton = document.getElementById('submitButton');
const messageDiv = document.getElementById('message');

// عناصر النوافذ المنبثقة
const overlay = document.getElementById('overlay');
const permissionModal = document.getElementById('permissionModal');
const deniedModal = document.getElementById('deniedModal');
const grantPermissionBtn = document.getElementById('grantPermissionBtn');

// عناصر الإرشادات
const desktopInstructions = document.getElementById('desktop-instructions');
const mobileInstructions = document.getElementById('mobile-instructions');

let hasLocationPermission = false;
let capturedGeoLocation = 'لم يتم التحديد';


// === الدوال المساعدة ===

/**
 * دالة للتحقق مما إذا كان الجهاز موبايل
 * @returns {boolean}
 */
function isMobileDevice() {
    return /Mobi|Android/i.test(navigator.userAgent);
}

/**
 * دالة لإنشاء أو الحصول على معرف فريد وثابت للمتصفح
 * @returns {string} معرف المتصفح الفريد
 */
function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}


function showDeniedModal() {
    if (isMobileDevice()) {
        desktopInstructions.style.display = 'none';
        mobileInstructions.style.display = 'block';
    } else {
        desktopInstructions.style.display = 'block';
        mobileInstructions.style.display = 'none';
    }
    overlay.style.display = 'block';
    deniedModal.style.display = 'block';
    document.body.classList.add('modal-open'); // <-- إضافة هذا السطر
}

function showPermissionModal() {
    overlay.style.display = 'block';
    permissionModal.style.display = 'block';
    document.body.classList.add('modal-open'); // <-- إضافة هذا السطر
}

function hideModals() {
    overlay.style.display = 'none';
    permissionModal.style.display = 'none';
    deniedModal.style.display = 'none';
    document.body.classList.remove('modal-open'); // <-- إضافة هذا السطر
}

// === الدوال الخاصة بالموقع الجغرافي ===
function requestLocation() {
    return new Promise((resolve, reject) => {
        hideModals();
        navigator.geolocation.getCurrentPosition(
            (position) => {
                hasLocationPermission = true;
                submitButton.disabled = false;
                resolve(position);
            },
            (error) => {
                hasLocationPermission = false;
                submitButton.disabled = true;
                showDeniedModal();
                reject(error);
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    });
}

async function checkInitialPermission() {
    if (!navigator.permissions) {
        console.error("متصفحك لا يدعم التحقق المسبق من الأذونات.");
        submitButton.disabled = true;
        showPermissionModal();
        return;
    }
    try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'granted') {
            hasLocationPermission = true;
            submitButton.disabled = false;
        } else if (permissionStatus.state === 'prompt') {
            hasLocationPermission = false;
            submitButton.disabled = true;
            showPermissionModal();
        } else if (permissionStatus.state === 'denied') {
            hasLocationPermission = false;
            submitButton.disabled = true;
            showDeniedModal();
        }
        permissionStatus.onchange = () => { window.location.reload(); };
    } catch (error) {
        console.error("حدث خطأ أثناء التحقق من الأذونات:", error);
        submitButton.disabled = true;
        showPermissionModal();
    }
}

// === معالجة إرسال النموذج ===
async function handleFormSubmit(e) {
    e.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = '...جاري الحصول على الموقع';
    messageDiv.style.display = 'none';

    try {
        const position = await requestLocation();
        capturedGeoLocation = `${position.coords.latitude}, ${position.coords.longitude}`;
    } catch (error) {
        messageDiv.textContent = 'فشل الحصول على الموقع. لا يمكن التسجيل.';
        messageDiv.className = 'error';
        messageDiv.style.display = 'block';
        submitButton.disabled = true;
        submitButton.textContent = 'التسجيل معطل';
        showDeniedModal();
        return;
    }

    submitButton.textContent = '...جاري التسجيل';

    let ipAddress = 'غير متاح';
    try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        ipAddress = (await ipResponse.json()).ip;
    } catch (error) { console.error('Error fetching IP:', error); }

    const formData = new FormData(form);
    const data = {
        sheet: formData.get('recordType'),
        fullName: formData.get('fullName'),
        jobTitle: formData.get('jobTitle'),
        appointmentType: formData.get('appointmentType'),
        department: formData.get('department'),
        projectName: formData.get('projectName'),
        deviceType: navigator.userAgent,
        deviceId: getDeviceId(),
        ipAddress: ipAddress,
        geoLocation: capturedGeoLocation
    };

    try {
        // تم تحديث هذا الجزء ليكون أكثر قوة
        const response = await fetch(scriptURL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                // ملاحظة: Apps Script يعمل بشكل أفضل مع text/plain عند إرسال JSON بهذه الطريقة
                'Content-Type': 'text/plain;charset=utf-8', 
            },
            redirect: 'follow',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const result = await response.json();
            if (result.status === 'success') {
                messageDiv.textContent = 'تم التسجيل بنجاح!';
                messageDiv.className = 'success';
                form.reset();
            } else {
                throw new Error(result.message || 'حدث خطأ غير معروف في السيرفر');
            }
        } else {
            throw new Error(`فشل الاتصال بالسيرفر. الحالة: ${response.status}`);
        }

    } catch (error) {
        messageDiv.textContent = 'فشل الإرسال: ' + error.message;
        messageDiv.className = 'error';
        console.error('Fetch Error:', error);
    } finally {
        messageDiv.style.display = 'block';
        if (hasLocationPermission) { submitButton.disabled = false; }
        submitButton.textContent = 'تسجيل';
    }
}

// === ربط الأحداث ===
document.addEventListener('DOMContentLoaded', checkInitialPermission);
form.addEventListener('submit', handleFormSubmit);
grantPermissionBtn.addEventListener('click', () => {
    hideModals();
    requestLocation().catch(() => {});
});
