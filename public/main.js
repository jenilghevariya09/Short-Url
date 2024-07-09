new Vue({
  el: '#app',
  data: {
    error: '',
    success: false,
    shortUrl: '',
    originalUrl: '',
    userId: '',
    fileId: ''
  },
  methods: {
    createShortUrl() {
      const body = {
        originalUrl: this.originalUrl,
        userId: this.userId,
        fileId: this.fileId
      };

      fetch('/shorten', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'content-type': 'application/json'
        }
      }).then(response => response.json()
      ).then(result => {
        if (result.isJoi) {
          this.error = result.details.map(detail => detail.message).join('. ');
        } else {
          this.shortUrl = result.shortUrl;
          this.success = true;
        }
      }).catch(err => {
        this.error = 'An error occurred while generating the short URL.';
        console.error(err);
      });
    }
  }
});
