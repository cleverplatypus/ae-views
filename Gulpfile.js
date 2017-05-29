var gulp = require('gulp');
var babel = require('gulp-babel');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var jshint = require('gulp-jshint');

gulp.task('bundle', () =>
    gulp.src('./dist/**.js')
    .pipe(babel({
        presets: ['es2015', 'stage-0']
    }))
    .pipe(uglify())
    .pipe(rename('bundle.js'))
    .pipe(gulp.dest('build'))
);

gulp.task('lint', () => {
    return gulp.src('./src/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'));
});
