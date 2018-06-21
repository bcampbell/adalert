OUTFILES = ../extension/icons/icon-48.png \
	../extension/icons/icon-grey-48.png \
	../extension/icons/icon-red-48.png

#	../img/chromestore_icon-128.png

.PHONY: all

all: $(OUTFILES)


../extension/icons/icon-48.png: logo.svg
	convert $< -resize 44x44 -bordercolor transparent -border 2 $@

../extension/icons/icon-grey-48.png: logo-grey.svg
	convert $< -resize 44x44 -bordercolor transparent -border 2 $@

../extension/icons/icon-red-48.png: logo-red.svg
	convert $< -resize 44x44 -bordercolor transparent -border 2 $@

# manually added a glow in gimp, so removed here
#../img/chromestore_icon-128.png: logo.svg
#	convert $< -resize 96x96 -bordercolor transparent -border 16 $@

