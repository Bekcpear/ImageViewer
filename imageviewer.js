/*
    ImageViewer v 1.1.3-s
    Author: Sudhanshu Yadav
    Modified by Bekcpear
    Copyright (c) 2015-2016 to Sudhanshu Yadav - ignitersworld.com , released under the MIT license.
    Demo of original version on: http://ignitersworld.com/lab/imageViewer.html
*/

/*** picture view plugin ****/
(function ($, window, document, undefined) {
    "use strict";

    //an empty function
    var noop = function () {};

    var $body = $('body'),
        $window = $(window),
        $document = $(document);


    //constants
    var ZOOM_CONSTANT = 15; //increase or decrease value for zoom on mouse wheel
    var MOUSE_WHEEL_COUNT = 5; //A mouse delta after which it should stop preventing default behaviour of mouse wheel

    //ease out method
    /*
        t : current time,
        b : intial value,
        c : changed value,
        d : duration
    */
    function easeOutQuart(t, b, c, d) {
        t /= d;
        t--;
        return -c * (t * t * t * t - 1) + b;
    };


    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

    // requestAnimationFrame polyfill by Erik Möller
    // fixes from Paul Irish and Tino Zijdel

    (function () {
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
            window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
        }

        if (!window.requestAnimationFrame)
            window.requestAnimationFrame = function (callback, element) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function () {
                        callback(currTime + timeToCall);
                    },
                    timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };

        if (!window.cancelAnimationFrame)
            window.cancelAnimationFrame = function (id) {
                clearTimeout(id);
            };
    }());

    //function to check if image is loaded
    function imageLoaded(img) {
        return img.complete && (typeof img.naturalWidth === 'undefined' || img.naturalWidth !== 0);
    }

    var imageViewHtml = '<div class="iv-loader"></div>' + '<div class="iv-image-view" ><div class="iv-image-wrap" ></div></div>';

    //add a full screen view
    $(function () {
        if(!$body.length) $body = $('body');
        $body.append('<div id="iv-container">' + imageViewHtml + '<div class="iv-close"></div><div>');
    });

    function Slider(container, options) {
        this.container = container;
        this.onMove = options.onMove || noop;
        this.sliderId = options.sliderId || 'slider' + Math.ceil(Math.random() * 1000000);
    }

    Slider.prototype.init = function () {
        var self = this,
            container = this.container,
            eventSuffix = '.' + this.sliderId;

        //assign event on image wrap
        this.container.on('touchstart' + eventSuffix + ' mousedown' + eventSuffix, function (estart) {
          estart.preventDefault();
            var touchMove = (estart.type == "touchstart" ? "touchmove" : "mousemove") + eventSuffix,
                touchEnd  = (estart.type == "touchstart" ? "touchend" : "mouseup") + eventSuffix,
                eOrginal  = estart.originalEvent,
                sx        = eOrginal.clientX || ( eOrginal.touches ? eOrginal.touches[0].clientX : 0 ),
                sy        = eOrginal.clientY || ( eOrginal.touches ? eOrginal.touches[0].clientY : 0 ),
                mmx       = sx,
                mmy       = sy;

            var touchT0   = Date.now(),
                touchT1   = Date.now(),
                mFlag     = 0;

            var moveListener  = function (emove) {
                emove.preventDefault();

                eOrginal      = emove.originalEvent;

                //get the cordinates
                var mx        = eOrginal.clientX || ( eOrginal.touches ? eOrginal.touches[0].clientX : mmx ),
                    my        = eOrginal.clientY || ( eOrginal.touches ? eOrginal.touches[0].clientY : mmy ),
                    dx        = mx - mmx,
                    dy        = my - mmy;

                touchT1       = Date.now();
                if (touchT1 - touchT0 > 100) {
                    sx        = mmx;
                    sy        = mmy;
                    mFlag     = 0;
                }

                var moveRatio = Math.abs(mx - sx) / Math.abs(my - sy);

                dy            = moveRatio > 5   || mFlag < 3 ? 0 : dy;
                dx            = moveRatio < 0.3 || mFlag < 3 ? 0 : dx;

                self.onMove(emove, {
                    dx: dx,
                    dy: dy,
                    mx: mx,
                    my: my
                });
                mmx           = mx;
                mmy           = my;
                touchT0       = Date.now();
                mFlag++;
            };

            var endListener = function () {
                $document.off(touchMove, moveListener);
                $document.off(touchEnd, endListener);
            };

            $document.on(touchMove, moveListener);
            $document.on(touchEnd, endListener);
        });

        return this;
    }


    function ImageViewer(options) {
        var self = this;
        var container = $('#iv-container');
        self._fullPage = true;

        self.container = container;
        options = self.options = $.extend({}, ImageViewer.defaults, options);

        self.zoomValue = 100;

        if (!container.find('.iv-image-view').length) {
            container.prepend(imageViewHtml);
        }

        container.addClass('iv-container');

        if (container.css('position') == 'static') container.css('position', 'relative');

        self.imageWrap = container.find('.iv-image-wrap');
        self._viewerId = 'iv' + Math.floor(Math.random() * 1000000);
    }


    ImageViewer.prototype = {
        constructor: ImageViewer,
        _init: function () {
            var viewer = this,
                options = viewer.options,
                zooming = false, // tell weather we are zooming trough touch
                container = this.container;

            var eventSuffix = '.' + viewer._viewerId;

            //cache dom refrence
            var imageWrap = this.imageWrap;

            /*Add slide interaction to image*/
            var imageSlider = viewer._imageSlider = new Slider(imageWrap, {
                sliderId: viewer._viewerId,
                onMove: function (e, position) {
                    if (!viewer.loaded) return;
                    if (zooming) return;
                    this.currentPos = position;
                    var imgLeft = parseFloat(viewer.currentImg.css('left')) + position.dx,
                        imgTop  = parseFloat(viewer.currentImg.css('top'))  + position.dy;
                    viewer.currentImg.css({
                        left: imgLeft + 'px',
                        top: imgTop + 'px'
                    })
                },
            }).init();

            /*Add zoom interation in mouse wheel*/
            var changedDelta = 0;
            container.on("mousewheel" + eventSuffix + " DOMMouseScroll" + eventSuffix, function (e) {
                if(!options.zoomOnMouseWheel) return;
                if (!viewer.loaded) return;

                //clear all animation frame and interval
                viewer._clearFrames();

                // cross-browser wheel delta
                var delta = Math.max(-1, Math.min(1, (e.originalEvent.wheelDelta || -e.originalEvent.detail))),
                    zoomValue = viewer.zoomValue * (100 + delta * ZOOM_CONSTANT) / 100;

                if(!(zoomValue >= options.minZoom && zoomValue <= options.maxZoom)){
                    changedDelta += Math.abs(delta);
                }
                else{
                    changedDelta = 0;
                }

                if(changedDelta > MOUSE_WHEEL_COUNT) return;

                e.preventDefault();

                var contOffset = container.offset(),
                    x = (e.pageX || e.originalEvent.pageX) - contOffset.left,
                    y = (e.pageY || e.originalEvent.pageY) - contOffset.top;

                viewer.zoom(zoomValue, {
                    x: x,
                    y: y
                });
            });


            //apply pinch and zoom feature
            imageWrap.on('touchstart' + eventSuffix, function (estart) {
                if (!viewer.loaded) return;
                var touch0 = estart.originalEvent.touches[0],
                    touch1 = estart.originalEvent.touches[1];

                if (!(touch0 && touch1)) {
                    return;
                }


                zooming = true;

                var contOffset = container.offset();

                var startdist = Math.sqrt(Math.pow(touch1.pageX - touch0.pageX, 2) + Math.pow(touch1.pageY - touch0.pageY, 2)),
                    startZoom = viewer.zoomValue,
                    center = {
                        x: ((touch1.pageX + touch0.pageX) / 2) - contOffset.left,
                        y: ((touch1.pageY + touch0.pageY) / 2) - contOffset.top
                    }

                var moveListener = function (emove) {
                    emove.preventDefault();

                    var touch0 = emove.originalEvent.touches[0],
                        touch1 = emove.originalEvent.touches[1],
                        newDist = Math.sqrt(Math.pow(touch1.pageX - touch0.pageX, 2) + Math.pow(touch1.pageY - touch0.pageY, 2)),
                        zoomValue = startZoom + (newDist - startdist) / 2;

                    viewer.zoom(zoomValue, center);
                };

                var endListener = function () {
                    $document.off('touchmove', moveListener);
                    $document.off('touchend', endListener);
                    zooming = false;
                };

                $document.on('touchmove', moveListener);
                $document.on('touchend', endListener);

            });


            //handle double tap for zoom in and zoom out
            var touchtime0 = 0,
                touchtime1 = 0,
                point;
            imageWrap.on('click' + eventSuffix, function (e) {
                touchtime0 = Date.now();
                point = {
                    x: e.pageX,
                    y: e.pageY
                };
                if ((touchtime0 - touchtime1) < 300 && Math.abs(e.pageX - point.x) < 50 && Math.abs(e.pageY - point.y) < 50) {
                    if (viewer.zoomValue == options.zoomValue) {
                        if (viewer.imageDim.sw / viewer.imageDim.w > 2) {
                            viewer.zoom(viewer.imageDim.sw / viewer.imageDim.w * 100)
                        } else {
                            viewer.zoom(200)
                        }
                    } else {
                        viewer.resetZoom()
                    }
                touchtime1 = 0;
                return;
                }
                touchtime1 = Date.now();
            });

            // key up/down/left/right to move image
            var pressT0    = Date.now(),
                pressT1    = Date.now(),
                pressCode  = 0,
                pressMulti = 1;
            $(document).on('keydown' + eventSuffix + ' keyup' + eventSuffix, function(e) {
                if ( $('#iv-container').css('display') === 'block'
                     && (   (e.keyCode >= 37 && e.keyCode <= 40)
                          || e.keyCode === 27
                          || e.key === '+'
                          || e.key === '-'
                        )
                   ) {
                    e.preventDefault();
                    pressT1 = Date.now();
                    if (pressT1 - pressT0 < 60 && e.keyCode === pressCode && e.altKey) {
                        pressMulti++;
                    } else {
                        pressMulti = 1;
                    }
                    pressT0 = Date.now();
                    pressCode = e.keyCode;
                    pressMulti = e.altKey  ? Math.min(pressMulti, 5) : pressMulti * 10;
                    pressMulti = e.ctrlKey ? pressMulti * 10 : pressMulti;
                    if (e.type === 'keydown') {
                        switch (e.keyCode) {
                            case 37: // left
                              viewer._imageSlider.onMove(null, {
                                dx: -1 * pressMulti,
                                dy: 0
                              });
                              break;
                            case 38: // up
                              viewer._imageSlider.onMove(null, {
                                dx: 0,
                                dy: -1 * pressMulti
                              });
                              break;
                            case 39: // right
                              viewer._imageSlider.onMove(null, {
                                dx: 1 * pressMulti,
                                dy: 0
                              });
                              break;
                            case 40: // down
                              viewer._imageSlider.onMove(null, {
                                dx: 0,
                                dy: 1 * pressMulti
                              });
                              break;
                        }
                        switch (e.key) {
                            case '+':
                              if (e.ctrlKey) viewer.zoom(viewer.zoomValue * 1.5);
                              else viewer.zoom(viewer.zoomValue * ( 100 + pressMulti ) / 100);
                              break;
                            case '-':
                              if (e.ctrlKey) viewer.zoom(viewer.zoomValue * 0.5);
                              else viewer.zoom(viewer.zoomValue * ( 100 - pressMulti ) / 100);
                              break;
                        }
                    } else if (e.type === 'keyup') {
                        if (e.keyCode === 27) {
                            viewer.hide();
                        }
                    }
                }
            });

            //calculate elments size on window resize
            if (options.refreshOnResize) $window.on('resize' + eventSuffix, function () {
                viewer.refresh()
            });

            if (viewer._fullPage) {
                //prevent scrolling the backside if container if fixed positioned
                container.on('touchmove' + eventSuffix + ' mousewheel' + eventSuffix + ' DOMMouseScroll' + eventSuffix, function (e) {
                    e.preventDefault();
                });

                container.find('.iv-close').on('click' + eventSuffix, function () {
                    viewer.hide();
                });
                container.find('.iv-image-view').on('click' + eventSuffix, function () {
                    if ( ! $('.iv-large-image').is(':hover') ) viewer.hide();
                });
            }
        },

        //method to zoom images
        zoom: function (perc, point) {
            perc   = Math.round(Math.max(this.options.minZoom, perc));
            perc   = Math.min(this.options.maxZoom, perc);

            point = point || {
                x: this.containerDim.w / 2,
                y: this.containerDim.h / 2
            };

            var self         = this,
                maxZoom      = this.options.maxZoom,
                curPerc      = this.zoomValue,
                curImg       = this.currentImg,
                containerDim = this.containerDim,
                curLeft      = parseFloat(curImg.css('left')),
                curTop       = parseFloat(curImg.css('top'));

            this.zoomT0      = this.zoomT0 ? this.zoomT0 : 0,
            this.zoomT1      = Date.now(),
            this.zoomC       = 0;

            if (this.zoomT1 - this.zoomT0 < 100
                && (
                     (perc <= 100 && curPerc >= 100)
                  || (perc >= 100 && curPerc <= 100)
                )
                && this.zoomC < 10 ) {
              perc = 100;
              this.zoomC++;
            } else {
              this.zoomC = 0;
            }
            this.zoomT0      = Date.now(),

            self._clearFrames();

            var step = 0;
            
            //calculate base top,left,bottom,right
            var containerDim = self.containerDim,
                imageDim     = self.imageDim;
            var baseLeft     = (containerDim.w - imageDim.w) / 2,
                baseTop      = (containerDim.h - imageDim.h) / 2,
                baseRight    = containerDim.w - baseLeft,
                baseBottom   = containerDim.h - baseTop;

            function zoom() {
                step++;

                if (step < 20) {
                    self._zoomFrame = requestAnimationFrame(zoom);
                }

                var tickZoom = easeOutQuart(step, curPerc, perc - curPerc, 20);


                var ratio = tickZoom / curPerc,
                    imgWidth = self.imageDim.w * tickZoom / 100,
                    imgHeight = self.imageDim.h * tickZoom / 100,
                    newLeft = -((point.x - curLeft) * ratio - point.x),
                    newTop = -((point.y - curTop) * ratio - point.y);

                if (perc < curPerc && perc >= 100) {
                    //fix for left and top
                    newLeft = Math.min(newLeft, baseLeft);
                    newTop = Math.min(newTop, baseTop);

                    //fix for right and bottom
                    if((newLeft + imgWidth) < baseRight){
                        newLeft = baseRight - imgWidth; //newLeft - (newLeft + imgWidth - baseRight)
                    }

                    if((newTop + imgHeight) < baseBottom){
                        newTop =  baseBottom - imgHeight; //newTop + (newTop + imgHeight - baseBottom)
                    }
                } else if (perc > curPerc && perc <= 100) {
                    //fix for left and top
                    newLeft = (containerDim.w - imgWidth) / 2;
                    newTop  = (containerDim.h - imgHeight) / 2;
                }
                
                curImg.css({
                    height: imgHeight + 'px',
                    width: imgWidth + 'px',
                    left: newLeft + 'px',
                    top: newTop + 'px'
                });

                self.zoomValue = tickZoom;
            }

            zoom();
        },
        _clearFrames: function () {
            cancelAnimationFrame(this._zoomFrame)
        },
        resetZoom: function () {
            this.zoom(this.options.zoomValue);
        },
        //calculate dimensions of image, container and reset the image
        _calculateDimensions: function () {
            //calculate content width of image
            var self = this,
                curImg = self.currentImg,
                container = self.container,
                imageWidth = curImg.width(),
                imageHeight = curImg.height(),
                contWidth = container.width(),
                contHeight = container.height();

            //set the container dimension
            self.containerDim = {
                w: contWidth,
                h: contHeight
            }

            //set the image dimension
            var imgWidth, imgHeight, ratio = imageWidth / imageHeight;

            imgWidth = (imageWidth > imageHeight && contHeight >= contWidth) || ratio * contHeight > contWidth ? contWidth : ratio * contHeight;
            imgWidth = ((imageWidth > imageHeight && contHeight >= contWidth) || ratio * contHeight > contWidth) && imageWidth < contWidth ? imageWidth : imgWidth;

            imgHeight = imgWidth / ratio;

            self.imageDim = {
                w:  imgWidth,
                h:  imgHeight,
                sw: imageWidth,
                sh: imageHeight
            }

            //reset image position and zoom
            curImg.css({
                width: imgWidth + 'px',
                height: imgHeight + 'px',
                left: (contWidth - imgWidth) / 2 + 'px',
                top: (contHeight - imgHeight) / 2 + 'px'
            });

            self.options.maxZoom = imageWidth > imgWidth ? imageWidth / imgWidth * self.options.maxZoom : self.options.maxZoom;
        },
        refresh: function () {
            if (!this.loaded) return;
            this._calculateDimensions();
            this.resetZoom();
        },
        show: function (image, hiResImg = "") {
            if (this._fullPage) {
                this.container.show();
                if (image) this.load(image, hiResImg);
            }
        },
        hide: function () {
            if (this._fullPage) {
                this.container.hide();
            }
        },
        options: function (key, value) {
            if (!value) return this.options[key];

            this.options[key] = value;
        },
        destroy: function (key, value) {
            var eventSuffix = '.' + this._viewerId;
            if (this._fullPage) {
                container.off(eventSuffix);
                container.find('[class^="iv"]').off(eventSuffix);
            } else {
                this.container.remove('[class^="iv"]');
            }
            $window.off(eventSuffix);
            return null;
        },
        load: function (image, hiResImg) {
            var self = this,
                container = this.container;

            container.find('.iv-large-image').remove();
            this.imageWrap.prepend('<img class="iv-large-image" src="' + image + '" />');

            if (hiResImg) {
                this.imageWrap.append('<img class="iv-large-image" src="' + hiResImg + '" />')
            }

            var currentImg = this.currentImg = this.container.find('.iv-large-image');
            self.loaded = false;

            //show loader
            container.find('.iv-loader').show();
            currentImg.hide();

            //refresh the view
            function refreshView() {
                self.loaded = true;
                self.zoomValue = 100;

                //reset zoom of images
                currentImg.show();
                self.refresh();
                self.resetZoom();

                //hide loader
                container.find('.iv-loader').hide();
            }

            if (imageLoaded(currentImg[0])) {
                refreshView();
            } else {
                $(currentImg[0]).on('load', refreshView);
            }

        }
    }

    ImageViewer.defaults = {
        zoomValue: 100,
        minZoom: 20,
        maxZoom: 500,
        refreshOnResize: true,
        zoomOnMouseWheel : true
    }

    window.ImageViewer = function (options) {
        var viewer = new ImageViewer(options);
        viewer._init();
        return viewer;
    };
}((window.jQuery), window, document));
