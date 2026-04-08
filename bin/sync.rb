#!/usr/bin/env ruby
# frozen_string_literal: true

# Kaya Sync Script
# Synchronizes local ~/.kaya/ directory with the Kaya server API
#
# Directory structure:
#   ~/.kaya/anga/  - bookmarks, notes, PDFs, images, and other files
#   ~/.kaya/meta/  - human tags and metadata for anga records (TOML files)
#   ~/.kaya/words/ - extracted text content for bookmarks (download-only)

require "net/http"
require "uri"
require "json"
require "fileutils"
require "optparse"
require "io/console"
require "securerandom"

class KayaSync
  DEFAULT_URL = "https://savebutton.com"
  KAYA_DIR = File.expand_path("~/.kaya")
  ANGA_DIR = File.join(KAYA_DIR, "anga")
  META_DIR = File.join(KAYA_DIR, "meta")
  WORDS_DIR = File.join(KAYA_DIR, "words")

  def initialize(options)
    @email = options[:email]
    @password = options[:password]
    @base_url = options[:url]
    @url_from_options = !options[:url].nil?
    @verbose = options[:verbose]

    @stats = {
      anga: { downloaded: [], uploaded: [], errors: [] },
      meta: { downloaded: [], uploaded: [], errors: [] },
      words: { downloaded: [], errors: [] }
    }
  end

  def run
    prompt_credentials
    ensure_local_dirs

    log "Connecting to #{@base_url}..."
    log "Syncing files for #{@email}"
    log ""

    sync_anga
    sync_meta
    sync_words

    print_summary
  end

  private

  def prompt_credentials
    unless @base_url
      print "Kaya Server URL [#{DEFAULT_URL}]: "
      url_input = $stdin.gets.chomp
      @base_url = url_input.empty? ? DEFAULT_URL : url_input.chomp("/")
    end

    print "Email: "
    @email = $stdin.gets.chomp

    print "Password: "
    @password = $stdin.noecho(&:gets).chomp
    puts

    if !@url_from_options
      puts ""
      print "Will sync with #{@base_url} as #{@email}. Continue? [Y/n]: "
      confirm = $stdin.gets.chomp.downcase
      if confirm == "n"
        puts ""
        print "Kaya Server URL [#{@base_url}]: "
        url_input = $stdin.gets.chomp
        @base_url = url_input.empty? ? @base_url : url_input.chomp("/")
        print "Email: "
        @email = $stdin.gets.chomp
        print "Password: "
        @password = $stdin.noecho(&:gets).chomp
        puts
      end
      puts ""
    end
  end

  def ensure_local_dirs
    FileUtils.mkdir_p(ANGA_DIR)
    FileUtils.mkdir_p(META_DIR)
    FileUtils.mkdir_p(WORDS_DIR)
  end

  # ============================================================================
  # Anga Sync
  # ============================================================================

  def sync_anga
    log "--- Syncing Anga (files) ---"

    server_files = fetch_server_anga_files
    local_files = fetch_local_anga_files

    files_to_download = server_files - local_files
    files_to_upload = local_files - server_files

    log "Server has #{server_files.size} anga files"
    log "Local has #{local_files.size} anga files"
    log "To download: #{files_to_download.size}"
    log "To upload: #{files_to_upload.size}"
    log ""

    download_anga_files(files_to_download)
    upload_anga_files(files_to_upload)
  end

  def fetch_server_anga_files
    uri = URI("#{@base_url}/api/v1/#{@email}/anga")

    response = make_request(:get, uri)

    if response.is_a?(Net::HTTPSuccess)
      response.body.split("\n").map(&:strip).reject(&:empty?)
    else
      log_error "Failed to fetch server anga list: #{response.code} #{response.message}"
      exit 1
    end
  end

  def fetch_local_anga_files
    return [] unless Dir.exist?(ANGA_DIR)

    Dir.entries(ANGA_DIR)
       .reject { |f| f.start_with?(".") }
       .select { |f| File.file?(File.join(ANGA_DIR, f)) }
  end

  def download_anga_files(files)
    files.each do |filename|
      download_anga_file(filename)
    end
  end

  def download_anga_file(filename)
    uri = URI("#{@base_url}/api/v1/#{@email}/anga/#{filename}")

    response = make_request(:get, uri)

    if response.is_a?(Net::HTTPSuccess)
      local_path = File.join(ANGA_DIR, filename)
      File.binwrite(local_path, response.body)
      log "[ANGA DOWNLOAD] #{filename}"
      @stats[:anga][:downloaded] << filename
    else
      log_error "[ANGA DOWNLOAD FAILED] #{filename}: #{response.code} #{response.message}"
      @stats[:anga][:errors] << { file: filename, operation: :download, error: "#{response.code} #{response.message}" }
    end
  end

  def upload_anga_files(files)
    files.each do |filename|
      unless filename_url_safe?(filename)
        log_error "[ANGA REJECTED] #{filename} contains invalid characters for URL (space, quotes, etc.)"
        @stats[:anga][:errors] << { file: filename, operation: :upload, error: "Filename contains URL-illegal characters" }
        next
      end
      upload_anga_file(filename)
    end
  end

  def upload_anga_file(filename)
    local_path = File.join(ANGA_DIR, filename)
    uri = URI("#{@base_url}/api/v1/#{@email}/anga/#{filename}")

    file_content = File.binread(local_path)
    content_type = mime_type_for(filename)

    response = make_request(:post, uri, file_content, content_type, filename)

    case response
    when Net::HTTPCreated, Net::HTTPSuccess
      log "[ANGA UPLOAD] #{filename}"
      @stats[:anga][:uploaded] << filename
    when Net::HTTPConflict
      log "[ANGA SKIP] #{filename} (already exists on server)"
    when Net::HTTPExpectationFailed
      log_error "[ANGA UPLOAD FAILED] #{filename}: Filename mismatch"
      @stats[:anga][:errors] << { file: filename, operation: :upload, error: "Filename mismatch" }
    else
      log_error "[ANGA UPLOAD FAILED] #{filename}: #{response.code} #{response.message}"
      @stats[:anga][:errors] << { file: filename, operation: :upload, error: "#{response.code} #{response.message}" }
    end
  end

  # ============================================================================
  # Meta Sync
  # ============================================================================

  def sync_meta
    log "--- Syncing Meta (tags/metadata) ---"

    server_files = fetch_server_meta_files
    local_files = fetch_local_meta_files

    files_to_download = server_files - local_files
    files_to_upload = local_files - server_files

    log "Server has #{server_files.size} meta files"
    log "Local has #{local_files.size} meta files"
    log "To download: #{files_to_download.size}"
    log "To upload: #{files_to_upload.size}"
    log ""

    download_meta_files(files_to_download)
    upload_meta_files(files_to_upload)
  end

  def fetch_server_meta_files
    uri = URI("#{@base_url}/api/v1/#{@email}/meta")

    response = make_request(:get, uri)

    if response.is_a?(Net::HTTPSuccess)
      response.body.split("\n").map(&:strip).reject(&:empty?)
    else
      log_error "Failed to fetch server meta list: #{response.code} #{response.message}"
      exit 1
    end
  end

  def fetch_local_meta_files
    return [] unless Dir.exist?(META_DIR)

    Dir.entries(META_DIR)
       .reject { |f| f.start_with?(".") }
       .select { |f| File.file?(File.join(META_DIR, f)) }
       .select { |f| f.end_with?(".toml") }
  end

  def download_meta_files(files)
    files.each do |filename|
      download_meta_file(filename)
    end
  end

  def download_meta_file(filename)
    uri = URI("#{@base_url}/api/v1/#{@email}/meta/#{filename}")

    response = make_request(:get, uri)

    if response.is_a?(Net::HTTPSuccess)
      local_path = File.join(META_DIR, filename)
      File.binwrite(local_path, response.body)
      log "[META DOWNLOAD] #{filename}"
      @stats[:meta][:downloaded] << filename
    else
      log_error "[META DOWNLOAD FAILED] #{filename}: #{response.code} #{response.message}"
      @stats[:meta][:errors] << { file: filename, operation: :download, error: "#{response.code} #{response.message}" }
    end
  end

  def upload_meta_files(files)
    files.each do |filename|
      unless filename_url_safe?(filename)
        log_error "[META REJECTED] #{filename} contains invalid characters for URL (space, quotes, etc.)"
        @stats[:meta][:errors] << { file: filename, operation: :upload, error: "Filename contains URL-illegal characters" }
        next
      end
      upload_meta_file(filename)
    end
  end

  def upload_meta_file(filename)
    local_path = File.join(META_DIR, filename)
    uri = URI("#{@base_url}/api/v1/#{@email}/meta/#{filename}")

    file_content = File.binread(local_path)
    content_type = "application/toml"

    response = make_request(:post, uri, file_content, content_type, filename)

    case response
    when Net::HTTPCreated, Net::HTTPSuccess
      log "[META UPLOAD] #{filename}"
      @stats[:meta][:uploaded] << filename
    when Net::HTTPConflict
      log "[META SKIP] #{filename} (already exists on server)"
    when Net::HTTPExpectationFailed
      log_error "[META UPLOAD FAILED] #{filename}: Filename mismatch"
      @stats[:meta][:errors] << { file: filename, operation: :upload, error: "Filename mismatch" }
    when Net::HTTPUnprocessableEntity
      log_error "[META UPLOAD FAILED] #{filename}: Invalid TOML format"
      @stats[:meta][:errors] << { file: filename, operation: :upload, error: "Invalid TOML format" }
    else
      log_error "[META UPLOAD FAILED] #{filename}: #{response.code} #{response.message}"
      @stats[:meta][:errors] << { file: filename, operation: :upload, error: "#{response.code} #{response.message}" }
    end
  end

  # ============================================================================
  # Words Sync (download-only)
  # ============================================================================

  def sync_words
    log "--- Syncing Words (extracted text) ---"

    server_words = fetch_server_words
    local_words = fetch_local_words

    words_to_download = server_words - local_words

    log "Server has #{server_words.size} words records"
    log "Local has #{local_words.size} words records"
    log "To download: #{words_to_download.size}"
    log ""

    # Download missing words directories
    download_words(words_to_download)

    # For existing local words, sync any missing files
    sync_existing_words(local_words & server_words)
  end

  def fetch_server_words
    uri = URI("#{@base_url}/api/v1/#{@email}/words")

    response = make_request(:get, uri)

    if response.is_a?(Net::HTTPSuccess)
      response.body.split("\n").map(&:strip).reject(&:empty?)
    else
      log_error "Failed to fetch server words list: #{response.code} #{response.message}"
      exit 1
    end
  end

  def fetch_local_words
    return [] unless Dir.exist?(WORDS_DIR)

    Dir.entries(WORDS_DIR)
       .reject { |f| f.start_with?(".") }
       .select { |f| File.directory?(File.join(WORDS_DIR, f)) }
  end

  def fetch_word_files(anga)
    uri = URI("#{@base_url}/api/v1/#{@email}/words/#{anga}")

    response = make_request(:get, uri)

    if response.is_a?(Net::HTTPSuccess)
      response.body.split("\n").map(&:strip).reject(&:empty?)
    else
      log_error "Failed to fetch word file list for #{anga}: #{response.code} #{response.message}"
      []
    end
  end

  def fetch_local_word_files(anga)
    anga_dir = File.join(WORDS_DIR, anga)
    return [] unless Dir.exist?(anga_dir)

    Dir.entries(anga_dir)
       .reject { |f| f.start_with?(".") }
       .select { |f| File.file?(File.join(anga_dir, f)) }
  end

  def download_words(words_list)
    words_list.each do |anga|
      download_word(anga)
    end
  end

  def download_word(anga)
    anga_dir = File.join(WORDS_DIR, anga)
    FileUtils.mkdir_p(anga_dir)

    server_files = fetch_word_files(anga)
    server_files.each do |filename|
      download_word_file(anga, filename)
    end
  end

  def sync_existing_words(words_list)
    words_list.each do |anga|
      server_files = fetch_word_files(anga)
      local_files = fetch_local_word_files(anga)

      files_to_download = server_files - local_files
      files_to_download.each do |filename|
        download_word_file(anga, filename)
      end
    end
  end

  def download_word_file(anga, filename)
    uri = URI("#{@base_url}/api/v1/#{@email}/words/#{anga}/#{filename}")

    response = make_request(:get, uri)

    if response.is_a?(Net::HTTPSuccess)
      anga_dir = File.join(WORDS_DIR, anga)
      FileUtils.mkdir_p(anga_dir)
      local_path = File.join(anga_dir, filename)
      File.binwrite(local_path, response.body)
      log "[WORDS DOWNLOAD] #{anga}/#{filename}"
      @stats[:words][:downloaded] << "#{anga}/#{filename}"
    else
      log_error "[WORDS DOWNLOAD FAILED] #{anga}/#{filename}: #{response.code} #{response.message}"
      @stats[:words][:errors] << { file: "#{anga}/#{filename}", operation: :download, error: "#{response.code} #{response.message}" }
    end
  end

  # ============================================================================
  # Common Methods
  # ============================================================================

  def make_request(method, uri, body = nil, content_type = nil, filename = nil)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = 10
    http.read_timeout = 30

    request = case method
    when :get
      Net::HTTP::Get.new(uri)
    when :post
      req = Net::HTTP::Post.new(uri)
      if body
        boundary = "----KayaSyncBoundary#{SecureRandom.hex(16)}"
        req["Content-Type"] = "multipart/form-data; boundary=#{boundary}"
        req.body = build_multipart_body(boundary, filename, body, content_type)
      end
      req
    end

    request.basic_auth(@email, @password)

    http.request(request)
  rescue StandardError => e
    log_error "Network error: #{e.message}"
    exit 1
  end

  def build_multipart_body(boundary, filename, content, content_type)
    body = []
    body << "--#{boundary}"
    body << "Content-Disposition: form-data; name=\"file\"; filename=\"#{filename}\""
    body << "Content-Type: #{content_type}"
    body << ""
    body << content
    body << "--#{boundary}--"
    body.join("\r\n")
  end

  def mime_type_for(filename)
    ext = File.extname(filename).downcase
    case ext
    when ".md" then "text/markdown"
    when ".url" then "text/plain"
    when ".txt" then "text/plain"
    when ".json" then "application/json"
    when ".toml" then "application/toml"
    when ".pdf" then "application/pdf"
    when ".png" then "image/png"
    when ".jpg", ".jpeg" then "image/jpeg"
    when ".gif" then "image/gif"
    when ".webp" then "image/webp"
    when ".svg" then "image/svg+xml"
    when ".html", ".htm" then "text/html"
    else "application/octet-stream"
    end
  end

def filename_url_safe?(filename)
    illegal_chars = /[\s"#$%?<>\\{}|^\[\]`]/
    illegal_chars !~ filename
  end

  def log(message)
    puts message
  end

  def log_error(message)
    $stderr.puts message
  end

  def print_summary
    total_downloaded = @stats[:anga][:downloaded].size + @stats[:meta][:downloaded].size + @stats[:words][:downloaded].size
    total_uploaded = @stats[:anga][:uploaded].size + @stats[:meta][:uploaded].size
    total_errors = @stats[:anga][:errors].size + @stats[:meta][:errors].size + @stats[:words][:errors].size

    log ""
    log "=" * 50
    log "SYNC COMPLETE"
    log "=" * 50
    log ""
    log "Anga (files):"
    log "  Downloaded: #{@stats[:anga][:downloaded].size}"
    log "  Uploaded:   #{@stats[:anga][:uploaded].size}"
    log "  Errors:     #{@stats[:anga][:errors].size}"
    log ""
    log "Meta (tags/metadata):"
    log "  Downloaded: #{@stats[:meta][:downloaded].size}"
    log "  Uploaded:   #{@stats[:meta][:uploaded].size}"
    log "  Errors:     #{@stats[:meta][:errors].size}"
    log ""
    log "Words (extracted text):"
    log "  Downloaded: #{@stats[:words][:downloaded].size}"
    log "  Errors:     #{@stats[:words][:errors].size}"
    log ""
    log "Total: #{total_downloaded} downloaded, #{total_uploaded} uploaded, #{total_errors} errors"

    all_errors = @stats[:anga][:errors] + @stats[:meta][:errors] + @stats[:words][:errors]
    if all_errors.any?
      log ""
      log "Errors:"
      all_errors.each do |error|
        log "  - #{error[:operation].upcase} #{error[:file]}: #{error[:error]}"
      end
    end

    log ""
  end
end

# Parse command line options
options = {}

OptionParser.new do |opts|
  opts.banner = "Usage: #{$0} [options]"

  opts.on("-e", "--email EMAIL", "Your Kaya account email") do |email|
    options[:email] = email
  end

  opts.on("-p", "--password PASSWORD", "Your Kaya account password") do |password|
    options[:password] = password
  end

  opts.on("-u", "--url URL", "Kaya server URL (default: #{KayaSync::DEFAULT_URL})") do |url|
    options[:url] = url.chomp("/")
  end

  opts.on("-v", "--verbose", "Enable verbose output") do
    options[:verbose] = true
  end

  opts.on("-h", "--help", "Show this help message") do
    puts opts
    exit
  end
end.parse!

# Run sync
KayaSync.new(options).run
