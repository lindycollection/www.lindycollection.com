// Gulp and node
// const gulp = require('gulp');
import gulp from 'gulp'
// const cp = require('child_process');
import cp from 'child_process'

// Basic workflow plugins
// const sass = require('gulp-sass');
import sass from 'gulp-sass'
const jekyll = process.platform === 'win32' ? 'jekyll.bat' : 'jekyll';
const messages = {
    jekyllBuild: '<span style="color: grey">Running:</span> $ jekyll build'
};

// Performance workflow plugins
// const htmlmin = require('gulp-htmlmin');
import htmlmin from 'gulp-htmlmin'
// const prefix = require('gulp-autoprefixer');
import prefix from 'gulp-autoprefixer'
// const sourcemaps = require('gulp-sourcemaps');
import sourcemaps from 'gulp-sourcemaps'
// const concat = require('gulp-concat');
import concat from 'gulp-concat'
// const uglify = require('gulp-uglify');
import uglify from 'gulp-uglify'

// Image Generation TODO
// const responsive = require('gulp-responsive');
import responsive from 'gulp-responsive'
// const $ = require('gulp-load-plugins')(); // WTF?
import gulp_plugins from 'gulp-load-plugins'
// const $ = gulp_plugins()
// const rename = require('gulp-rename');
import rename from 'gulp-rename'
// const imagemin = require('gulp-imagemin');
import imagemin from 'gulp-imagemin'

const src = {
  css: '_sass/main.scss',
  js: '_js/**/*.js',
}
const dist = {
  css: '_site/assets/css',
  js: '_site/assets/js',
}



// Complie SCSS to CSS & Prefix
gulp.task('sass', function() {
  return gulp.src(src.css)
    .pipe(sourcemaps.init())
    .pipe(sass({
      outputStyle: 'compressed',
      includePaths: ['scss'],
      // functions: sassFunctions(),
      // onError: browserSync.notify
    }))
    .pipe(prefix())
    .pipe(sourcemaps.write('./maps'))
    .pipe(gulp.dest(dist.css))
    .pipe(gulp.dest('assets/css'));
});

// // Uglify JS
// gulp.task('js', function() {
//   return gulp.src([
//       'node_modules/jquery/dist/jquery.js',
//       'node_modules/lazysizes/plugins/unveilhooks/ls.unveilhooks.js',
//       'node_modules/lazysizes/lazysizes.js',
//       'node_modules/velocity-animate/velocity.js',
//       src.js
//     ])
//     .pipe(concat('bundle.js'))
//     .pipe(uglify())
//     .pipe(gulp.dest(dist.js))
//     .pipe(browserSync.reload({stream: true}))
//     .pipe(gulp.dest('assets/js'))
//     .on('error', function(err){
//       console.error('Error in uglify taks', err.toString());
//     });
// });

// gulp.task('critical', function (cb) {
//   critical.generate({
//     base: '_site/',
//     src: 'index.html',
//     css: ['assets/css/main.css'],
//     dimensions: [{
//       width: 320,
//       height: 480
//     },{
//       width: 768,
//       height: 1024
//     },{
//       width: 1280,
//       height: 960
//     }],
//     dest: '../_includes/critical.css',
//     minify: true,
//     extract: false,
//     ignore: ['@font-face']
//   });
// });


gulp.task('default', ['sass', 'img']);

// Minify HTML
gulp.task('html', function() {
    gulp.src('./_site/index.html')
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(gulp.dest('./_site'))
    gulp.src('./_site/*/*html')
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(gulp.dest('./_site/./'))
});

// Images
gulp.task('img', function() {
  return gulp.src('_original_assets/*.{png,jpg}')
    .pipe($.responsive({
      // For all the images in the folder
      '*': [{
        width: 230,
        rename: {suffix: '_placehold'},
        format: 'jpg',
      }, {
        // thubmnail
        width: 535,
        rename: { suffix: '_thumb' },
        format: 'jpg',
      }, {
        // thumbnail @2x
        width: 535 * 2,
        rename: { suffix: '_thumb@2x' },
        format: 'jpg',
      }, {
        width: 575,
        rename: { suffix: '_xs'},
        format: 'jpg',
      }, {
        width: 767,
        rename: {suffix: '_sm'},
        format: 'jpg',
      }, {
        width: 991,
        rename: { suffix: '_md' },
        format: 'jpg',
      }, {
        width: 1999,
        rename: { suffix: '_lg' },
        format: 'jpg',
        withoutEnlargement: false,
      }, {
        // max-width hero
        width: 1920,
        format: 'jpg',
        withoutEnlargement: false,
      }],
    }, {
      quality: 70,
      progressive: true,
      withMetadata: false,
    }))
    .pipe(imagemin())
    .pipe(gulp.dest('assets/img/posts/'));
});
