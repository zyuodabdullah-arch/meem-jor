/* ====================================================================
طبقة البيانات المشتركة — ميم | MEEM JOR
تستخدمها index.html (الموقع) و admin.html (لوحة التحكم) معاً.

إذا Firebase مفعّل (شوفي firebase-config.js) بتشتغل كل البيانات
مباشرة (Firestore) وبتنعكس فوراً عند كل الزوار.

صور المنتجات تُرفع عبر السيرفر إلى ImageKit
ويتم حفظ رابط الصورة داخل بيانات المنتج.

إذا مو مفعّل، بتشتغل بوضع محلي (localStorage) على نفس الجهاز بس.
==================================================================== */

const MeemData = (function () {

  let fbApp = null;
  let db = null;
  let auth = null;

  const usingFirebase =
    typeof FIREBASE_ENABLED !== 'undefined' && FIREBASE_ENABLED;


  /* ================================================================
     FIREBASE INIT
  ================================================================ */

  if (usingFirebase) {

    try {

      fbApp = firebase.initializeApp(FIREBASE_CONFIG);

      db = firebase.firestore();

      auth = firebase.auth();

    } catch (e) {

      console.error(
        'Firebase init failed, falling back to local mode',
        e
      );

    }

  }


  /* ================================================================
     LOCAL STORAGE KEYS
  ================================================================ */

  const LS_PRODUCTS = 'meem_products_v1';

  const LS_REVIEWS = 'meem_reviews_v1';

  const LS_SUGGESTIONS = 'meem_suggestions_v1';


  /* ================================================================
     LOCAL STORAGE HELPERS
  ================================================================ */

  function lsGet(key, fallback) {

    try {

      const v = localStorage.getItem(key);

      return v
        ? JSON.parse(v)
        : fallback;

    } catch (e) {

      return fallback;

    }

  }


  function lsSet(key, val) {

    try {

      localStorage.setItem(
        key,
        JSON.stringify(val)
      );

    } catch (e) {

      console.error(
        'localStorage write failed',
        e
      );

    }

  }


  function ensureLocalProducts() {

    let list =
      lsGet(
        LS_PRODUCTS,
        null
      );

    if (!list) {

      list =
        typeof DEFAULT_PRODUCTS !== 'undefined'
          ? DEFAULT_PRODUCTS
          : [];

      lsSet(
        LS_PRODUCTS,
        list
      );

    }

    return list;

  }


  /* ================================================================
     LISTENERS
  ================================================================ */

  const listeners = {

    products: [],

    reviews: [],

    suggestions: []

  };


  function emit(kind, data) {

    listeners[kind].forEach(
      cb => cb(data)
    );

  }


  /* ================================================================
     PRODUCTS
  ================================================================ */

  function listenProducts(cb) {

    listeners.products.push(cb);


    if (db) {

      db.collection('products')
        .orderBy('order', 'asc')
        .onSnapshot(

          snap => {

            const list = [];

            snap.forEach(doc => {

              list.push(

                Object.assign(
                  {
                    id: doc.id
                  },
                  doc.data()
                )

              );

            });

            emit(
              'products',
              list
            );

          },


          err => {

            console.error(
              'products listener error',
              err
            );

            cb(
              ensureLocalProducts()
            );

          }

        );

    } else {

      cb(
        ensureLocalProducts()
      );

    }

  }


  /* ================================================================
     FIRESTORE INITIAL PRODUCTS
  ================================================================ */

  async function seedFirestoreIfEmpty() {

    if (!db) return;


    const snap =
      await db
        .collection('products')
        .limit(1)
        .get();


    if (
      snap.empty &&
      typeof DEFAULT_PRODUCTS !== 'undefined'
    ) {

      const batch =
        db.batch();


      DEFAULT_PRODUCTS.forEach(
        (p, i) => {

          const ref =
            db
              .collection('products')
              .doc();


          const clean =
            Object.assign(
              {},
              p
            );


          delete clean.id;


          clean.order = i;


          batch.set(
            ref,
            clean
          );

        }
      );


      await batch.commit();

    }

  }


  /* ================================================================
     PRODUCT IMAGE UPLOAD
     Admin → server.js → ImageKit → URL
  ================================================================ */

  async function uploadProductImage(file) {

    if (!file) {

      throw new Error(
        'لم يتم اختيار صورة.'
      );

    }


    try {

      const formData =
        new FormData();


      formData.append(
        'file',
        file
      );


      /*
        حالياً أثناء التطوير المحلي:

        admin.html
        ↓
        localhost:3000
        ↓
        server.js
        ↓
        ImageKit

        لاحقاً على Render رح نغيّر الرابط
        من localhost إلى رابط السيرفر الحقيقي.
      */

      const response =
        await fetch(
          'http://localhost:3000/api/upload-image',
          {
            method: 'POST',
            body: formData
          }
        );


      let result;


      try {

        result =
          await response.json();

      } catch (jsonError) {

        throw new Error(
          'السيرفر أعاد استجابة غير صالحة.'
        );

      }


      if (!response.ok) {

        console.error(
          'Image upload error:',
          result
        );


        throw new Error(

          result.error ||

          result.message ||

          'فشل رفع الصورة'

        );

      }


      if (!result.url) {

        throw new Error(
          'لم يتم استلام رابط الصورة.'
        );

      }


      console.log(
        'Image uploaded:',
        result.url
      );


      return result.url;


    } catch (error) {

      console.error(
        'uploadProductImage error:',
        error
      );


      throw error;

    }

  }


  /* ================================================================
     ADD PRODUCT
  ================================================================ */

  async function addProduct(product) {

    if (db) {

      const countSnap =
        await db
          .collection('products')
          .get();


      const clean =
        Object.assign(
          {},
          product,
          {
            order:
              countSnap.size
          }
        );


      await db
        .collection('products')
        .add(clean);

    } else {

      const list =
        ensureLocalProducts();


      const id =
        'local_' +
        Date.now();


      list.push(

        Object.assign(
          {
            id: id
          },
          product
        )

      );


      lsSet(
        LS_PRODUCTS,
        list
      );


      emit(
        'products',
        list
      );

    }

  }


  /* ================================================================
     UPDATE PRODUCT
  ================================================================ */

  async function updateProduct(
    id,
    patch
  ) {

    if (db) {

      await db
        .collection('products')
        .doc(id)
        .update(patch);

    } else {

      const list =
        ensureLocalProducts();


      const idx =
        list.findIndex(
          p => p.id === id
        );


      if (idx > -1) {

        list[idx] =
          Object.assign(
            {},
            list[idx],
            patch
          );


        lsSet(
          LS_PRODUCTS,
          list
        );


        emit(
          'products',
          list
        );

      }

    }

  }


  /* ================================================================
     DELETE PRODUCT
  ================================================================ */

  async function deleteProduct(id) {

    if (db) {

      await db
        .collection('products')
        .doc(id)
        .delete();

    } else {

      let list =
        ensureLocalProducts();


      list =
        list.filter(
          p => p.id !== id
        );


      lsSet(
        LS_PRODUCTS,
        list
      );


      emit(
        'products',
        list
      );

    }

  }


  /* ================================================================
     LOCAL PRODUCTS SNAPSHOT
  ================================================================ */

  function getProductsSnapshotSync() {

    return ensureLocalProducts();

  }


  /* ================================================================
     REVIEWS
  ================================================================ */

  function listenReviews(cb) {

    listeners.reviews.push(cb);


    if (db) {

      db.collection('reviews')
        .orderBy(
          'createdAt',
          'desc'
        )
        .onSnapshot(

          snap => {

            const list = [];


            snap.forEach(
              doc => {

                list.push(

                  Object.assign(
                    {
                      id: doc.id
                    },
                    doc.data()
                  )

                );

              }
            );


            emit(
              'reviews',
              list
            );

          },


          err => {

            console.error(
              'reviews listener error',
              err
            );


            cb(

              lsGet(
                LS_REVIEWS,
                []
              )

            );

          }

        );

    } else {

      cb(

        lsGet(
          LS_REVIEWS,
          []
        )

      );

    }

  }


  /* ================================================================
     ADD REVIEW
  ================================================================ */

  async function addReview(review) {

    if (db) {

      await db
        .collection('reviews')
        .add(

          Object.assign(
            {},
            review,
            {

              createdAt:

                firebase
                  .firestore
                  .FieldValue
                  .serverTimestamp()

            }
          )

        );

    } else {

      const list =
        lsGet(
          LS_REVIEWS,
          []
        );


      list.unshift(

        Object.assign(
          {

            id:
              'local_' +
              Date.now()

          },
          review
        )

      );


      lsSet(
        LS_REVIEWS,
        list
      );


      emit(
        'reviews',
        list
      );

    }

  }


  /* ================================================================
     DELETE REVIEW
  ================================================================ */

  async function deleteReview(id) {

    if (db) {

      await db
        .collection('reviews')
        .doc(id)
        .delete();

    } else {

      let list =
        lsGet(
          LS_REVIEWS,
          []
        );


      list =
        list.filter(
          r => r.id !== id
        );


      lsSet(
        LS_REVIEWS,
        list
      );


      emit(
        'reviews',
        list
      );

    }

  }


  /* ================================================================
     SUGGESTIONS
  ================================================================ */

  function listenSuggestions(cb) {

    listeners.suggestions.push(cb);


    if (db) {

      db.collection('suggestions')
        .orderBy(
          'createdAt',
          'desc'
        )
        .onSnapshot(

          snap => {

            const list = [];


            snap.forEach(
              doc => {

                list.push(

                  Object.assign(
                    {
                      id: doc.id
                    },
                    doc.data()
                  )

                );

              }
            );


            emit(
              'suggestions',
              list
            );

          },


          err => {

            console.error(
              'suggestions listener error',
              err
            );


            cb(

              lsGet(
                LS_SUGGESTIONS,
                []
              )

            );

          }

        );

    } else {

      cb(

        lsGet(
          LS_SUGGESTIONS,
          []
        )

      );

    }

  }


  /* ================================================================
     ADD SUGGESTION
  ================================================================ */

  async function addSuggestion(text) {

    if (db) {

      await db
        .collection('suggestions')
        .add({

          text: text,


          createdAt:

            firebase
              .firestore
              .FieldValue
              .serverTimestamp()

        });

    } else {

      const list =
        lsGet(
          LS_SUGGESTIONS,
          []
        );


      list.unshift({

        id:
          'local_' +
          Date.now(),


        text: text,


        date:
          new Date()
            .toISOString()

      });


      lsSet(
        LS_SUGGESTIONS,
        list
      );


      emit(
        'suggestions',
        list
      );

    }

  }


  /* ================================================================
     DELETE SUGGESTION
  ================================================================ */

  async function deleteSuggestion(id) {

    if (db) {

      await db
        .collection('suggestions')
        .doc(id)
        .delete();

    } else {

      let list =
        lsGet(
          LS_SUGGESTIONS,
          []
        );


      list =
        list.filter(
          s => s.id !== id
        );


      lsSet(
        LS_SUGGESTIONS,
        list
      );


      emit(
        'suggestions',
        list
      );

    }

  }


  /* ================================================================
     AUTH — ADMIN ONLY
  ================================================================ */

  async function adminSignIn(
    email,
    password
  ) {

    if (!auth) {

      throw new Error(
        'Firebase غير مفعّل — لا يوجد نظام دخول، أنتِ مسجّلة دخول محلياً تلقائياً.'
      );

    }


    return auth
      .signInWithEmailAndPassword(
        email,
        password
      );

  }


  /* ================================================================
     ADMIN LOGOUT
  ================================================================ */

  function adminSignOut() {

    if (auth) {

      return auth.signOut();

    }

  }


  /* ================================================================
     AUTH LISTENER
  ================================================================ */

  function onAuthChange(cb) {

    if (auth) {

      auth.onAuthStateChanged(cb);

    } else {

      /*
        Local mode:
        نعتبر المستخدم داخل لوحة التحكم.
      */

      cb({

        local: true

      });

    }

  }


  /* ================================================================
     PUBLIC API
  ================================================================ */

  return {

    usingFirebase,


    seedFirestoreIfEmpty,


    uploadProductImage,


    listenProducts,

    addProduct,

    updateProduct,

    deleteProduct,

    getProductsSnapshotSync,


    listenReviews,

    addReview,

    deleteReview,


    listenSuggestions,

    addSuggestion,

    deleteSuggestion,


    adminSignIn,

    adminSignOut,

    onAuthChange

  };

})();