var gulp = require('gulp');
var babel = require('gulp-babel');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
gulp.task('default', () =>
gulp.src('./src/**.js')
    .pipe(babel({
        presets: ['es2015', 'stage-0']
    }))
    .pipe(uglify())
    .pipe(rename('bundle.js'))
    .pipe(gulp.dest('dist'))
);
