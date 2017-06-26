# ImageViewer - modified
A zooming and panning plugin inspired by google photos for your web images.

Original version [here](https://github.com/s-yadav/ImageViewer).

Fetures of this modified version:

* zoom in/out
* free dragging image
* only full screen mode
* support touch device
* no snap view
* `arrow up/down/left/right` to control image to move
* `+/-` to zoom in/out image
* `alt/ctrl` for fine-tuning/Coarse-tuning
* `esc` to quit the view mode

Visit my [blog](https://nifume.com) to check the example.

Usage:

```
<link href=".../imageviewer.css" rel="stylesheet">
<script src=".../imageviewer.min.js"></script>
$(".img-responsive").css("cursor","pointer").on('click',function(){
  var imgSrc = this.src;
  ImageViewer().show(imgSrc);
});
```
